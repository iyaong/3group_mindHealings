// Load .env from project root explicitly to avoid CWD issues
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // attempt fallback to project root relative to this file
  const fallback = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../.env');
  if (fs.existsSync(fallback)) dotenv.config({ path: fallback });
}
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai';

// 환경변수: MONGO_URI(외부 IP 포함), DB_NAME, PORT
const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.DB_NAME || 'appdb';
// Vite proxy in vite.config.ts targets 7780; use that as default here for out-of-the-box dev.
const PORT = Number(process.env.PORT || 7780);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// 기본 모델: 최신 가용성이 높은 소형 모델로 설정 (필요시 .env로 재정의)
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';

// emotion_colors.json을 먼저 로드 (chatCompletionWithFallback에서 사용)
function loadUserEmotionColorsEarly(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), 'server/emotion_colors.json'),
    path.resolve(process.cwd(), 'emotion_colors.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const obj = JSON.parse(raw);
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj || {})) {
          if (!k || typeof k !== 'string') continue;
          if (typeof v === 'string') {
            const hex = v.startsWith('#') ? v : `#${v}`;
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
              out[k] = hex.toUpperCase();
            }
          }
        }
        return out;
      }
    } catch {
      // ignore parse errors and try next location
    }
  }
  return {};
}

const EMOTION_COLORS_EARLY = loadUserEmotionColorsEarly();

// 감정 색상 목록을 AI 프롬프트용 문자열로 변환
function getEmotionColorPrompt(): string {
  if (Object.keys(EMOTION_COLORS_EARLY).length === 0) {
    return '감정에 맞는 색상을 자유롭게 선택해주세요.';
  }
  const list = Object.entries(EMOTION_COLORS_EARLY)
    .map(([emotion, color]) => `${emotion}: ${color}`)
    .join(', ');
  return `다음 감정-색상 매핑 중에서 선택해주세요: ${list}`;
}

async function chatCompletionWithFallback(openai: OpenAI, messages: Array<{ role: string; content: string }>, primaryModel?: string) {
  const preferred = primaryModel || OPENAI_MODEL;
  const emotionColorGuide = getEmotionColorPrompt();
  
  try {
  return await openai.chat.completions.create({ model: preferred, messages: [
        ...messages.map((m: any) => ({ role: m.role, content: String(m.content) })),
        {
          role: 'system',
          content: `
            1. 다정하고 친근하게 말해줘
            2. (사용자 몰래, 사용자의 대화에서 감정이 느껴질 때) 대화 끝에 {"color":"#RRGGBB"} 형태의 JSON을 포함시켜줘
            color는 현재 사용자의 감정에 가장 어울리는 색상이야.
            color의 채도는 사용자의 감정이 격해질 수록 높아져.
            
            감정 색상 가이드:
            ${emotionColorGuide}
            
            위 목록에서 사용자의 감정과 가장 일치하는 색상을 선택하되, 감정의 강도에 따라 채도를 조절해줘.`
        }
      ], temperature: 0.7 });
  } catch (e: any) {
    const msg = e?.message || '';
    const status = e?.status || e?.code;
    const notFound = /model\s?.*does not exist|unknown model|not found/i.test(msg) || status === 404;
    if (notFound && preferred !== 'gpt-4.1-nano') {
      // 모델 미존재 시 gpt-4.1-nano로 폴백
  return await openai.chat.completions.create({ model: 'gpt-4.1-nano', messages: [
        ...messages.map((m: any) => ({ role: m.role, content: String(m.content) })),
        {
          role: 'system',
          content: `
            1. 다정하고 친근하게 말해줘
            2. (사용자 몰래, 사용자의 대화에서 감정이 느껴질 때) 대화 끝에 {"color":"#RRGGBB"} 형태의 JSON을 포함시켜줘
            color는 현재 사용자의 감정에 가장 어울리는 색상이야.
            color의 채도는 사용자의 감정이 격해질 수록 높아져.
            
            감정 색상 가이드:
            ${emotionColorGuide}
            
            위 목록에서 사용자의 감정과 가장 일치하는 색상을 선택하되, 감정의 강도에 따라 채도를 조절해줘.`
        }
      ], temperature: 0.7 });
    }
    throw e;
  }
}

function assertEnv() {
  const missing: string[] = [];
  if (!MONGO_URI) missing.push('MONGO_URI');
  if (!DB_NAME) missing.push('DB_NAME');
  if (!JWT_SECRET) missing.push('JWT_SECRET');
  if (!PORT) missing.push('PORT');
  if (missing.length) {
    console.error('필수 환경변수가 누락되었습니다:', missing.join(', '));
    process.exit(1);
  }
}
assertEnv();

const app = express();
// Allow cookies via CORS when frontend and API are on different origins (or proxied via Vite)
app.use(
  cors({
    origin: (_origin, cb) => cb(null, true), // reflect request origin
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

let cachedClient: MongoClient | null = null;
async function getClient() {
  // 캐시된 클라이언트가 있으면, ping으로 연결 상태를 확인
  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch {
      try { await cachedClient.close(); } catch {}
      cachedClient = null;
    }
  }
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

async function ensureIndexes() {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'uniq_email' });
  await db.collection('messages').createIndex({ userId: 1, createdAt: 1 }, { name: 'by_user_time' });
  await db.collection('ai_messages').createIndex({ userId: 1, createdAt: 1 }, { name: 'ai_by_user_time' });
    // 다이어리: 날짜별(YYYY-MM-DD)로 1개 문서, 사용자별 고유
    await db.collection('diaries').createIndex(
      { userId: 1, date: 1 },
      { unique: true, name: 'uniq_user_date' }
    );
    // 다이어리 메시지(대화) 인덱스
    await db.collection('diary_messages').createIndex(
      { diaryId: 1, createdAt: 1 },
      { name: 'by_diary_time' }
    );
  // 세션(한 날짜에 여러 대화 허용)
  await db.collection('diary_sessions').createIndex({ userId: 1, createdAt: 1 }, { name: 'session_by_user_time' });
  await db.collection('diary_session_messages').createIndex({ sessionId: 1, createdAt: 1 }, { name: 'by_session_time' });
  // 온라인 채팅 메시지 인덱스
  await db.collection('online_messages').createIndex({ createdAt: 1 }, { name: 'online_by_time' });
  // feedback indices
  await db.collection('emotion_color_feedback').createIndex({ userId: 1, emotion: 1, createdAt: -1 }, { name: 'by_user_emotion_time' });
  } catch (e) {
    console.warn('Index creation skipped:', (e as Error).message);
  }
}

function signToken(payload: { id: string; email: string }) {
  return jwt.sign({ sub: payload.id, email: payload.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req: any, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: '인증이 필요합니다.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: '세션이 유효하지 않습니다.' });
  }
}

// POST /api/login { email, password }
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력하세요.' });
    }

    const client = await getClient();
    const db = client.db(DB_NAME);
    const users = db.collection('users');

    // 해시된 비밀번호 비교
    const user = await users.findOne<{ _id: unknown; email: string; password: string }>({ email });
    if (!user) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = signToken({ id: String(user._id), email: user.email });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.json({ ok: true, user: { id: String(user._id), email: user.email } });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/register { email, password }
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력하세요.' });
    }
    const client = await getClient();
    const db = client.db(DB_NAME);
    const users = db.collection('users');

    const exists = await users.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await users.insertOne({ email, password: hash, createdAt: new Date() });
    return res.status(201).json({ ok: true, user: { id: String(result.insertedId), email } });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 인증된 사용자 정보
app.get('/api/me', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const users = db.collection('users');
    const me = await users.findOne({ _id: new (await import('mongodb')).ObjectId(req.user.sub) });
    if (!me) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    return res.json({ ok: true, user: { id: String(me._id), email: me.email } });
  } catch (e) {
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 로그아웃 (쿠키 제거)
app.post('/api/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

// 채팅 메시지 저장/조회 (사용자별)
app.get('/api/chat', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const items = await db
      .collection('messages')
      .find({ userId })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ message: '메시지 조회 중 오류가 발생했습니다.' });
  }
});

app.post('/api/chat', authMiddleware, async (req: any, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ message: 'text가 필요합니다.' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const doc = { userId, text, createdAt: new Date() };
    const result = await db.collection('messages').insertOne(doc);
    res.status(201).json({ ok: true, item: { ...doc, _id: result.insertedId } });
  } catch (e) {
    res.status(500).json({ message: '메시지 저장 중 오류가 발생했습니다.' });
  }
});

// AI Chat proxy: POST /api/ai/chat { messages: [{role, content}], model? }
app.post('/api/ai/chat', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    const { messages, model } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'messages 배열이 필요합니다.' });
    }
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const resp = await chatCompletionWithFallback(
      openai,
      messages.map((m: any) => ({ role: m.role, content: String(m.content) })),
      model
    );
    const content = resp.choices?.[0]?.message?.content ?? '';
    // persist user last message + assistant reply
    try {
      const client = await getClient();
      const db = client.db(DB_NAME);
      const userId = req.user.sub;
      const last = messages[messages.length - 1];
      if (last?.role === 'user') {
        await db.collection('ai_messages').insertOne({ userId, role: 'user', content: String(last.content || ''), createdAt: new Date() });
      }
      await db.collection('ai_messages').insertOne({ userId, role: 'assistant', content, createdAt: new Date() });
    } catch (persistErr) {
      console.warn('persist ai_messages failed:', (persistErr as Error).message);
    }
    res.json({ ok: true, content });
  } catch (e: any) {
    console.error('AI chat error:', e?.message || e);
    res.status(500).json({ message: 'AI 응답 생성 중 오류' });
  }
});

// AI chat history
app.get('/api/ai/history', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const items = await db
      .collection('ai_messages')
      .find({ userId })
      .sort({ createdAt: 1 })
      .limit(500)
      .project({ _id: 0, userId: 0 })
      .toArray();
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ message: 'AI 대화 이력 조회 오류' });
  }
});

// AI emotion analysis: POST /api/ai/analyze-emotion { text }
app.post('/api/ai/analyze-emotion', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    
    const { text, enhanced } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: '분석할 텍스트가 필요합니다.' });
    }
    
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    
    // enhanced=true이면 복합 감정 분석 사용
    if (enhanced) {
      // 이전 감정 데이터 가져오기 (최근 10개)
      const previousSessions = await db
        .collection('diary_sessions')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .project({ mood: 1, enhancedMood: 1 })
        .toArray();
      
      const previousMoods = previousSessions
        .map((s: any) => s.enhancedMood || s.mood)
        .filter(Boolean);
      
      // 복합 감정 분석 실행
      const enhancedMood = await detectEnhancedEmotion(text, previousMoods);
      
      // 기존 mood 형식도 함께 반환 (하위 호환성)
      const simpleMood = {
        emotion: enhancedMood.primary.emotion,
        score: enhancedMood.primary.score / 100, // 0-1 스케일로 변환
        color: enhancedMood.primary.color
      };
      
      res.json({ ok: true, mood: simpleMood, enhancedMood });
    } else {
      // 기존 단일 감정 분석
      const mood = await detectEmotionFromText(text);
      
      // 개인화된 색상 적용
      const personalizedColor = await personalizedColorForEmotion(db, userId, mood.color, mood.emotion);
      const finalMood = { ...mood, color: personalizedColor };
      
      res.json({ ok: true, mood: finalMood });
    }
  } catch (e: any) {
    console.error('감정 분석 API 오류:', e?.message || e);
    res.status(500).json({ message: '감정 분석 중 오류가 발생했습니다.' });
  }
});

// GET /api/emotion/history?days=7 - 감정 히스토리 조회
app.get('/api/emotion/history', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    
    // 조회할 일수 (기본: 7일, 최대: 30일)
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    
    // 날짜 범위 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // AI 세션 조회 (날짜 범위 내)
    const aiSessions = await db
      .collection('diary_sessions')
      .find({ 
        userId,
        type: 'ai',
        createdAt: { $gte: startDate, $lte: endDate }
      })
      .sort({ createdAt: 1 }) // 시간순 정렬
      .project({ 
        date: 1, 
        mood: 1, 
        enhancedMood: 1, 
        createdAt: 1,
        lastUpdatedAt: 1 
      })
      .toArray();
    
    // 온라인 채팅 세션 조회
    const onlineSessions = await db
      .collection('diary_sessions')
      .find({ 
        userId,
        type: 'online',
        createdAt: { $gte: startDate, $lte: endDate }
      })
      .sort({ createdAt: 1 })
      .project({ 
        date: 1, 
        mood: 1, 
        enhancedMood: 1, 
        createdAt: 1,
        lastUpdatedAt: 1 
      })
      .toArray();
    
    // 데이터 가공
    const formatSession = (session: any) => ({
      date: session.date,
      timestamp: session.lastUpdatedAt || session.createdAt,
      mood: session.mood,
      enhancedMood: session.enhancedMood,
      type: session.type || 'ai'
    });
    
    const aiHistory = aiSessions.map(formatSession);
    const onlineHistory = onlineSessions.map(formatSession);
    
    // 날짜별 감정 통계 계산
    const emotionStats = calculateEmotionStats(aiSessions.concat(onlineSessions));
    
    res.json({ 
      ok: true, 
      days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      aiHistory,
      onlineHistory,
      stats: emotionStats
    });
  } catch (e: any) {
    console.error('감정 히스토리 조회 오류:', e?.message || e);
    res.status(500).json({ message: '감정 히스토리 조회 중 오류가 발생했습니다.' });
  }
});

// 감정 통계 계산 함수
function calculateEmotionStats(sessions: any[]) {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      emotionDistribution: {},
      averageIntensity: 0,
      dominantEmotion: null,
      positiveRate: 0
    };
  }
  
  const emotionCounts: { [key: string]: number } = {};
  const emotionIntensities: { [key: string]: number[] } = {};
  let totalIntensity = 0;
  let positiveCount = 0;
  
  // 긍정적 감정 목록
  const positiveEmotions = ['기쁨', '행복', '평온/안도', '만족', '감사', '설렘', '희망'];
  
  sessions.forEach((session: any) => {
    const mood = session.enhancedMood?.primary || session.mood;
    if (!mood) return;
    
    const emotion = mood.emotion;
    const intensity = mood.intensity || mood.score * 100 || 50;
    
    // 감정별 카운트
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    
    // 감정별 강도 수집
    if (!emotionIntensities[emotion]) {
      emotionIntensities[emotion] = [];
    }
    emotionIntensities[emotion].push(intensity);
    
    totalIntensity += intensity;
    
    // 긍정 감정 카운트
    if (positiveEmotions.some(e => emotion.includes(e))) {
      positiveCount++;
    }
  });
  
  // 가장 빈번한 감정 찾기
  let dominantEmotion: string | null = null;
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantEmotion = emotion;
    }
  }
  
  // 감정별 평균 강도 계산
  const emotionDistribution: any = {};
  for (const [emotion, intensities] of Object.entries(emotionIntensities)) {
    const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    emotionDistribution[emotion] = {
      count: emotionCounts[emotion],
      percentage: Math.round((emotionCounts[emotion] / sessions.length) * 100),
      avgIntensity: Math.round(avgIntensity)
    };
  }
  
  return {
    totalSessions: sessions.length,
    emotionDistribution,
    averageIntensity: Math.round(totalIntensity / sessions.length),
    dominantEmotion,
    positiveRate: Math.round((positiveCount / sessions.length) * 100)
  };
}

// =====================
// 감정 인사이트 분석 API
// =====================

app.get('/api/emotion/insights', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.sub;
    const days = Math.min(30, Math.max(7, Number(req.query.days) || 30));
    
    const client = await getClient();
    const db = client.db(DB_NAME);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // mood가 있는 세션만 조회 (감정 분석이 완료된 세션)
    const sessions = await db.collection('diary_sessions')
      .find({
        userId,
        createdAt: { $gte: startDate },
        mood: { $exists: true, $ne: null } // mood 필드가 존재하고 null이 아닌 것만
      })
      .sort({ createdAt: 1 })
      .toArray();
    
    console.log(`📊 인사이트 조회: userId=${userId}, days=${days}, 감정 분석 완료 세션=${sessions.length}`);
    
    // 감정 분석이 완료된 세션이 없으면 조기 반환
    if (sessions.length === 0) {
      return res.json({
        ok: true,
        insights: {
          summary: '아직 감정 분석이 완료된 대화가 없습니다. AI와 대화를 나누고 "감정 분석" 버튼을 눌러보세요!',
          patterns: [],
          recommendations: [],
          weeklyTrend: null,
          bestDay: null,
          worstDay: null,
          totalSessions: 0,
          analyzedDays: days
        }
      });
    }
    
    // 감정 데이터 준비
    const emotionData = sessions.map(s => ({
      date: new Date(s.createdAt),
      emotion: s.mood.emotion,
      score: s.mood.score,
      intensity: s.enhancedMood?.primary?.intensity || s.mood.score * 100,
      dayOfWeek: new Date(s.createdAt).getDay()
    }));
    
    // 요일별 감정 집계
    const dayStats: { [key: number]: { count: number; totalIntensity: number; emotions: string[] } } = {};
    for (let i = 0; i < 7; i++) {
      dayStats[i] = { count: 0, totalIntensity: 0, emotions: [] };
    }
    
    emotionData.forEach(item => {
      const day = item.dayOfWeek;
      dayStats[day].count++;
      dayStats[day].totalIntensity += item.intensity;
      dayStats[day].emotions.push(item.emotion);
    });
    
    // 요일 이름 매핑
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    
    // 최고/최악의 요일 찾기
    let bestDay: { day: string; average: number } | null = null;
    let worstDay: { day: string; average: number } | null = null;
    let maxAvg = -1;
    let minAvg = 101;
    
    Object.keys(dayStats).forEach(dayKey => {
      const day = parseInt(dayKey);
      const stat = dayStats[day];
      if (stat.count > 0) {
        const avg = stat.totalIntensity / stat.count;
        if (avg > maxAvg) {
          maxAvg = avg;
          bestDay = { day: dayNames[day], average: Math.round(avg) };
        }
        if (avg < minAvg) {
          minAvg = avg;
          worstDay = { day: dayNames[day], average: Math.round(avg) };
        }
      }
    });
    
    // 주간 추세 계산
    const weeklyGroups: { [week: string]: number[] } = {};
    emotionData.forEach(item => {
      const weekKey = `${item.date.getFullYear()}-W${Math.ceil(item.date.getDate() / 7)}`;
      if (!weeklyGroups[weekKey]) weeklyGroups[weekKey] = [];
      weeklyGroups[weekKey].push(item.intensity);
    });
    
    const weeklyAverages = Object.values(weeklyGroups).map(intensities => {
      return Math.round(intensities.reduce((a, b) => a + b, 0) / intensities.length);
    });
    
    let weeklyTrend = 'stable';
    if (weeklyAverages.length >= 2) {
      const lastWeek = weeklyAverages[weeklyAverages.length - 1];
      const prevWeek = weeklyAverages[weeklyAverages.length - 2];
      if (lastWeek > prevWeek + 10) weeklyTrend = 'improving';
      else if (lastWeek < prevWeek - 10) weeklyTrend = 'declining';
    }
    
    // OpenAI로 인사이트 생성
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    
    const bestDayText = bestDay ? `${(bestDay as any).day} (평균 강도 ${(bestDay as any).average})` : '없음';
    const worstDayText = worstDay ? `${(worstDay as any).day} (평균 강도 ${(worstDay as any).average})` : '없음';
    
    const prompt = `당신은 감정 분석 전문가입니다. 다음 사용자의 ${days}일간 감정 데이터를 분석하여 인사이트를 제공하세요.

데이터:
- 총 대화 수: ${sessions.length}
- 가장 좋았던 요일: ${bestDayText}
- 가장 힘들었던 요일: ${worstDayText}
- 주간 추세: ${weeklyTrend === 'improving' ? '개선 중' : weeklyTrend === 'declining' ? '하락 중' : '안정적'}
- 주요 감정들: ${emotionData.slice(0, 10).map(e => e.emotion).join(', ')}

다음 JSON 형식으로 응답하세요:
{
  "summary": "2-3문장으로 전체 요약",
  "patterns": ["패턴1", "패턴2", "패턴3"] (최대 3개),
  "recommendations": ["조언1", "조언2", "조언3"] (최대 3개)
}

친근하고 따뜻한 톤으로 작성하세요.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    });
    
    const content = completion.choices[0]?.message?.content || '{}';
    const aiInsights = JSON.parse(content);
    
    res.json({
      ok: true,
      insights: {
        summary: aiInsights.summary || '데이터를 분석 중입니다.',
        patterns: aiInsights.patterns || [],
        recommendations: aiInsights.recommendations || [],
        weeklyTrend,
        bestDay,
        worstDay,
        totalSessions: sessions.length,
        analyzedDays: days
      }
    });
    
  } catch (e: any) {
    console.error('감정 인사이트 생성 오류:', e);
    res.status(500).json({ 
      ok: false, 
      error: '인사이트를 생성할 수 없습니다.',
      message: e.message 
    });
  }
});

// =====================
// 감정 목표 설정 및 추적 API
// =====================

// 목표 생성 (감정 목표 + 일반 스케줄 목표)
app.post('/api/goals', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.sub;
    const { category, type, targetValue, duration, description, dueDate, priority, tags } = req.body;

    // category: 'emotion' (감정 목표) 또는 'schedule' (일반 스케줄 목표)
    const goalCategory = category || 'emotion';

    if (goalCategory === 'emotion') {
      // 감정 목표 검증
      if (!type || !targetValue || !duration) {
        return res.status(400).json({ 
          ok: false, 
          message: '필수 필드가 누락되었습니다.' 
        });
      }
    } else if (goalCategory === 'schedule') {
      // 일반 스케줄 목표 검증
      if (!description || !dueDate) {
        return res.status(400).json({ 
          ok: false, 
          message: '일정 목표는 설명과 마감일이 필요합니다.' 
        });
      }
    }

    const client = await getClient();
    const db = client.db(DB_NAME);

    let goal: any = {
      userId,
      category: goalCategory,
      description: description || '',
      status: 'active', // 'active', 'completed', 'failed', 'cancelled'
      createdAt: new Date(),
      startDate: new Date()
    };

    if (goalCategory === 'emotion') {
      // 감정 목표 필드
      goal.type = type; // 'positiveRate', 'sessionCount', 'averageIntensity', 'specificEmotion'
      goal.targetValue = Number(targetValue);
      goal.currentValue = 0;
      goal.duration = Number(duration);
      goal.progress = 0;
      goal.endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    } else {
      // 일반 스케줄 목표 필드
      goal.title = req.body.title || description.substring(0, 30);
      goal.dueDate = new Date(dueDate);
      goal.priority = priority || 'medium'; // 'low', 'medium', 'high'
      goal.tags = tags || [];
      goal.isCompleted = false;
      goal.completedAt = null;
    }

    const result = await db.collection('goals').insertOne(goal);

    console.log(`🎯 목표 생성: userId=${userId}, category=${goalCategory}, type=${type || 'schedule'}`);

    res.json({
      ok: true,
      goal: { _id: result.insertedId, ...goal }
    });

  } catch (e: any) {
    console.error('목표 생성 오류:', e);
    res.status(500).json({ 
      ok: false, 
      error: '목표를 생성할 수 없습니다.',
      message: e.message 
    });
  }
});

// 목표 목록 조회
app.get('/api/goals', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.sub;
    const status = req.query.status; // 'active', 'completed', etc.
    const category = req.query.category; // 'emotion', 'schedule'

    const client = await getClient();
    const db = client.db(DB_NAME);

    const query: any = { userId };
    if (status) query.status = status;
    if (category) query.category = category;

    const goals = await db.collection('goals')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // 감정 목표의 진행률 업데이트
    for (const goal of goals) {
      if (goal.category === 'emotion') {
        await updateGoalProgress(db, goal);
      }
    }

    res.json({
      ok: true,
      goals
    });

  } catch (e: any) {
    console.error('목표 조회 오류:', e);
    res.status(500).json({ 
      ok: false, 
      error: '목표를 조회할 수 없습니다.',
      message: e.message 
    });
  }
});

// 목표 진행률 업데이트 함수
async function updateGoalProgress(db: any, goal: any) {
  try {
    const userId = goal.userId;
    const startDate = new Date(goal.startDate);
    const endDate = new Date(goal.endDate);
    const now = new Date();

    // 목표 기간이 지났는지 확인
    if (now > endDate && goal.status === 'active') {
      const achieved = goal.currentValue >= goal.targetValue;
      await db.collection('emotion_goals').updateOne(
        { _id: goal._id },
        { 
          $set: { 
            status: achieved ? 'completed' : 'failed',
            completedAt: now
          } 
        }
      );
      goal.status = achieved ? 'completed' : 'failed';
      return;
    }

    // 현재 값 계산
    let currentValue = 0;

    switch (goal.type) {
      case 'positiveRate': {
        // 긍정률 목표
        const sessions = await db.collection('diary_sessions')
          .find({
            userId,
            mood: { $exists: true, $ne: null },
            createdAt: { $gte: startDate, $lte: now }
          })
          .toArray();

        if (sessions.length > 0) {
          const positiveEmotions = ['기쁨', '행복', '사랑', '애정', '평온', '안도', '희망', '기대', '만족', '감사'];
          const positiveCount = sessions.filter(s => 
            positiveEmotions.includes(s.mood?.emotion)
          ).length;
          currentValue = Math.round((positiveCount / sessions.length) * 100);
        }
        break;
      }

      case 'sessionCount': {
        // 대화 횟수 목표
        const count = await db.collection('diary_sessions')
          .countDocuments({
            userId,
            createdAt: { $gte: startDate, $lte: now }
          });
        currentValue = count;
        break;
      }

      case 'averageIntensity': {
        // 평균 감정 강도 목표
        const sessions = await db.collection('diary_sessions')
          .find({
            userId,
            mood: { $exists: true, $ne: null },
            createdAt: { $gte: startDate, $lte: now }
          })
          .toArray();

        if (sessions.length > 0) {
          const totalIntensity = sessions.reduce((sum, s) => {
            const intensity = s.enhancedMood?.primary?.intensity || s.mood.score * 100;
            return sum + intensity;
          }, 0);
          currentValue = Math.round(totalIntensity / sessions.length);
        }
        break;
      }

      case 'specificEmotion': {
        // 특정 감정 횟수 목표
        const count = await db.collection('diary_sessions')
          .countDocuments({
            userId,
            'mood.emotion': goal.targetEmotion,
            createdAt: { $gte: startDate, $lte: now }
          });
        currentValue = count;
        break;
      }
    }

    // 진행률 계산
    const progress = Math.min(100, Math.round((currentValue / goal.targetValue) * 100));

    // DB 업데이트
    await db.collection('emotion_goals').updateOne(
      { _id: goal._id },
      { 
        $set: { 
          currentValue,
          progress,
          lastUpdated: now
        } 
      }
    );

    goal.currentValue = currentValue;
    goal.progress = progress;

  } catch (e) {
    console.error('목표 진행률 업데이트 오류:', e);
  }
}

// 목표 삭제
app.delete('/api/goals/:goalId', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.sub;
    const { goalId } = req.params;

    const client = await getClient();
    const db = client.db(DB_NAME);

    const result = await db.collection('goals').deleteOne({
      _id: new ObjectId(goalId),
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        ok: false, 
        message: '목표를 찾을 수 없습니다.' 
      });
    }

    res.json({ ok: true });

  } catch (e: any) {
    console.error('목표 삭제 오류:', e);
    res.status(500).json({ 
      ok: false, 
      error: '목표를 삭제할 수 없습니다.',
      message: e.message 
    });
  }
});

// 목표 상태 변경 (완료/취소 등)
app.patch('/api/goals/:goalId', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.sub;
    const { goalId } = req.params;
    const { status, isCompleted } = req.body;

    const client = await getClient();
    const db = client.db(DB_NAME);

    const updateData: any = {};
    
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed' || status === 'cancelled') {
        updateData.completedAt = new Date();
      }
    }
    
    if (isCompleted !== undefined) {
      updateData.isCompleted = isCompleted;
      updateData.completedAt = isCompleted ? new Date() : null;
      updateData.status = isCompleted ? 'completed' : 'active';
    }

    const result = await db.collection('goals').updateOne(
      { _id: new ObjectId(goalId), userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        ok: false, 
        message: '목표를 찾을 수 없습니다.' 
      });
    }

    res.json({ ok: true });

  } catch (e: any) {
    console.error('목표 상태 변경 오류:', e);
    res.status(500).json({ 
      ok: false, 
      error: '목표 상태를 변경할 수 없습니다.',
      message: e.message 
    });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    const client = await getClient();
    await client.db('admin').command({ ping: 1 });
  res.json({ ok: true, db: 'up', dbName: DB_NAME });
  } catch {
    res.status(500).json({ ok: false, db: 'down' });
  }
});

// =====================
// Online group chat (simple)
// =====================
app.get('/api/online/messages', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const items = await db
      .collection('online_messages')
      .find({})
      .sort({ createdAt: 1 })
      .limit(300)
      .toArray();
    res.json({ ok: true, items: items.map((m: any) => ({ id: String(m._id), user: m.user, text: m.text, createdAt: m.createdAt })) });
  } catch (e) {
    res.status(500).json({ message: '온라인 메시지 조회 오류' });
  }
});

app.post('/api/online/message', authMiddleware, async (req: any, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'text가 필요합니다.' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const user = String(req.user?.email || '익명');
    const doc = { user, text, createdAt: new Date() };
    const r = await db.collection('online_messages').insertOne(doc);
    res.status(201).json({ ok: true, id: String(r.insertedId) });
  } catch (e) {
    res.status(500).json({ message: '온라인 메시지 저장 오류' });
  }
});

// =====================
// Diary per-date storage
// =====================

type DiaryDoc = {
  _id?: any;
  userId: string;
  date: string; // YYYY-MM-DD
  title?: string;
  mood?: { emotion: string; score: number; color: string } | null;
  lastUpdatedAt: Date;
};

// YYYY-MM-DD 보정
function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getOrCreateDiary(db: any, userId: string, dateKey: string): Promise<DiaryDoc> {
  const col = db.collection('diaries');
  const found = (await col.findOne({ userId, date: dateKey })) as DiaryDoc | null;
  if (found) return found;
  const doc: DiaryDoc = { userId, date: dateKey, title: '', mood: null, lastUpdatedAt: new Date() };
  const r = await col.insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

// Canonical emotion categories used throughout learning/personalization
const CANONICAL_EMOTIONS = ['joy', 'sad', 'anger', 'fear', 'anxious', 'neutral'] as const;
type CanonicalEmotion = typeof CANONICAL_EMOTIONS[number];

// Map Korean variants and composite labels to canonical keys for consistent storage
function normalizeEmotionKey(raw: string): CanonicalEmotion {
  const k = String(raw || '').trim().toLowerCase();
  if (!k) return 'neutral';
  // direct hits
  if (CANONICAL_EMOTIONS.includes(k as CanonicalEmotion)) return k as CanonicalEmotion;
  // remove spaces
  const s = k.replace(/\s+/g, '');
  // synonyms
  const map: Record<string, CanonicalEmotion> = {
    // joy
    '기쁨': 'joy', '행복': 'joy', '사랑': 'joy', '사랑/애정': 'joy', '애정': 'joy', '희망': 'joy', '희망/기대': 'joy', '기대': 'joy', '놀람': 'joy', '놀람/경이': 'joy', '경이': 'joy', '감동': 'joy', '감동/존경': 'joy', '존경': 'joy', '흥분': 'joy', '흥분/열정': 'joy', '열정': 'joy',
    // sad
    '슬픔': 'sad', '우울': 'sad', '슬픔/우울': 'sad', '무기력': 'sad', '무기력/피로': 'sad', '피로': 'sad',
    // anger
    '분노': 'anger', '화': 'anger', '분노/화': 'anger', '짜증': 'anger', '경멸': 'anger', '질투': 'anger',
    // fear
    '두려움': 'fear', '공포': 'fear',
    // anxious
    '불안': 'anxious', '걱정': 'anxious', '불안/걱정': 'anxious',
    // neutral
    '중립': 'neutral', '무감정': 'neutral', '지루함': 'neutral', '안도': 'neutral', '안도/안심': 'neutral', '안심': 'neutral', '평온': 'neutral', '평온/안도': 'neutral', '신뢰': 'neutral', '신뢰/안정': 'neutral', '안정': 'neutral',
  };
  // try exact then strip slashes
  if (map[k]) return map[k];
  if (map[s]) return map[s];
  const noSlash = k.replace(/[\/]/g, '');
  if (map[noSlash]) return map[noSlash];
  return 'neutral';
}

// Base palette used by emotion detection (and as fallbacks)
// const BASE_EMOTION_COLORS: Record<string, string> = {
//   // English keys (used by detector)
//   joy: '#FFD166',        // warm yellow
//   sad: '#118AB2',        // deep blue
//   anger: '#EF476F',      // vibrant red-rose
//   fear: '#073B4C',       // midnight teal
//   anxious: '#06D6A0',    // minty green
//   neutral: '#A8A8A8',    // mid gray
//
//   // Common Korean synonyms mapped to the same hues
//   '기쁨': '#FFD166',
//   '행복': '#FFD166',
//   '슬픔': '#118AB2',
//   '우울': '#118AB2',
//   '분노': '#EF476F',
//   '짜증': '#EF476F',
//   '두려움': '#073B4C',
//   '공포': '#073B4C',
//   '불안': '#06D6A0',
//   '걱정': '#06D6A0',
//   '중립': '#A8A8A8',
//   '무감정': '#A8A8A8',
// };

// Optional: allow extending the palette from a JSON file without code changes.
// Place a file at server/emotion_colors.json or emotion_colors.json with the shape:
// { "감정": "#RRGGBB", "hope": "#RRGGBB", ... }
function loadUserEmotionColors(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), 'server/emotion_colors.json'),
    path.resolve(process.cwd(), 'emotion_colors.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const obj = JSON.parse(raw);
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj || {})) {
          if (!k || typeof k !== 'string') continue;
          if (typeof v === 'string') {
            const hex = v.startsWith('#') ? v : `#${v}`;
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
              const HEX = hex.toUpperCase();
              // 1) 원본 키만 보관 (emotion_colors.json의 키만 사용)
              out[k] = HEX;
              // 2) 표준 감정 키로 정규화한 항목을 생성하여 기본 팔레트를 덮어씌움
              // const canon = normalizeEmotionKey(k);
              // out[canon] = HEX;
            }
          }
        }
        return out;
      }
    } catch {
      // ignore parse errors and try next location
    }
  }
  return {};
}

// Final palette: base + user-extended (user entries override base on key collision)
const EMOTION_COLORS: Record<string, string> = {
  // ...BASE_EMOTION_COLORS,
  ...loadUserEmotionColors(),
};

// 감정 색상 매핑 출력
console.log('📊 Emotion Colors Loaded:');
console.log('═'.repeat(60));
Object.entries(EMOTION_COLORS).forEach(([mood, color]) => {
  console.log(`  ${mood.padEnd(20)} → ${color}`);
});
console.log('═'.repeat(60));
console.log(`✅ Total emotions: ${Object.keys(EMOTION_COLORS).length}\n`);

// Convert hex <-> HSL helpers (lightweight, for palette blending)
function hexToRgb01(hex: string){
  let c = hex.replace('#','');
  if(c.length===3) c=c.split('').map(x=>x+x).join('');
  const r=parseInt(c.slice(0,2),16)/255, g=parseInt(c.slice(2,4),16)/255, b=parseInt(c.slice(4,6),16)/255;
  return {r,g,b};
}
function rgb01ToHex(r:number,g:number,b:number){
  const to=(v:number)=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function mixHex(a:string,b:string,w:number){
  const A=hexToRgb01(a), B=hexToRgb01(b);
  return rgb01ToHex(A.r*(1-w)+B.r*w, A.g*(1-w)+B.g*w, A.b*(1-w)+B.b*w);
}

// Compute a personalized color for an emotion using recent accepted/corrected feedback
async function personalizedColorForEmotion(db: any, userId: string, baseColor: string, emotion: string){
  try{
    const canonical = normalizeEmotionKey(emotion);
    const fb = await db.collection('emotion_color_feedback')
      .find({ userId, emotion: canonical })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    if (!fb.length) return baseColor;
    // Weight accepted correctedColor > accepted original > rejected corrected
    let accR=0, accG=0, accB=0, W=0;
    for(const f of fb){
      const hex = (f.accepted ? (f.correctedColorHex || f.colorHex) : (f.correctedColorHex || null)) || null;
      if(!hex) continue;
      const {r,g,b}=hexToRgb01(hex);
      const w = f.accepted ? 1.0 : 0.4;
      accR += r*w; accG += g*w; accB += b*w; W += w;
    }
    if(W<=0) return baseColor;
    const avg = rgb01ToHex(accR/W, accG/W, accB/W);
    // Blend 60% toward personal average
    return mixHex(baseColor, avg, 0.6);
  }catch{ return baseColor; }
}

async function detectEmotionFromText(text: string): Promise<{ emotion: string; score: number; color: string }> {
  // emotion_colors.json의 감정 키 목록 생성
  const emotionKeys = Object.keys(EMOTION_COLORS);
  const emotionList = emotionKeys.join(', ');
  const defaultEmotion = emotionKeys[0] || '평온/안도';
  
  // 디버그: 분석할 텍스트의 마지막 200자 출력
  const textPreview = text.length > 200 ? '...' + text.slice(-200) : text;
  console.log('📝 감정 분석 텍스트:', textPreview);
  
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const prompt = `다음 한국어 텍스트에서 사용자의 전반적인 감정 상태를 분석하세요.
여러 메시지가 포함되어 있다면, 가장 최근 메시지에 더 높은 가중치를 두되 전체적인 맥락도 고려하세요.

감정 목록: ${emotionList}

출력 형식: {"emotion":"<감정 키 중 하나>","score":0..100}
- emotion: 위 목록에서 정확히 하나를 선택
- score: 해당 감정의 확신도 (0~100, 높을수록 확실함)

텍스트: ${text}`;

  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `You are an expert emotion analyzer that returns JSON only.
규칙:
1. 반드시 제공된 감정 목록 중 하나를 정확히 사용
2. 최근 메시지일수록 중요하게 고려
3. 일관성 있는 분석 (같은 텍스트는 항상 같은 결과)
4. score는 감정의 명확성과 강도를 반영 (애매하면 낮게, 명확하면 높게)`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, // 낮은 temperature로 일관성 향상
    });
    const raw = resp.choices?.[0]?.message?.content || '{}';
    console.log('🤖 OpenAI 응답:', raw);
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const emotion = String(parsed.emotion || defaultEmotion).trim();
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    // emotion_colors.json에 정의된 키만 사용
    const color = EMOTION_COLORS[emotion] || EMOTION_COLORS[defaultEmotion] || '#A8E6CF';
    console.log('✅ 최종 감정 분석:', { emotion, score, color });
    return { emotion, score, color };
  } catch (e) {
    console.error('❌ 감정 분석 오류:', e);
    return { emotion: defaultEmotion, score: 0, color: EMOTION_COLORS[defaultEmotion] || '#A8E6CF' };
  }
}

// ========== 감정 분석 고도화: 복합 감정 분석 ==========
interface EmotionDetail {
  emotion: string;
  score: number;
  color: string;
  intensity: number; // 0-100
}

interface EnhancedMoodResult {
  primary: EmotionDetail;
  secondary: EmotionDetail[];
  trend?: 'improving' | 'stable' | 'declining';
  triggerWords: string[];
  timestamp: string;
}

async function detectEnhancedEmotion(text: string, previousMoods?: any[]): Promise<EnhancedMoodResult> {
  const emotionKeys = Object.keys(EMOTION_COLORS);
  const emotionList = emotionKeys.join(', ');
  const defaultEmotion = emotionKeys[0] || '평온/안도';
  
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const prompt = `다음 한국어 텍스트에서 사용자의 감정을 **복합적으로** 분석하세요.

감정 목록: ${emotionList}

출력 형식 (반드시 JSON):
{
  "primary": {"emotion":"<주 감정>","score":0-100,"intensity":0-100},
  "secondary": [
    {"emotion":"<부 감정1>","score":0-100,"intensity":0-100},
    {"emotion":"<부 감정2>","score":0-100,"intensity":0-100}
  ],
  "triggerWords": ["키워드1", "키워드2", "키워드3"]
}

규칙:
1. primary: 가장 강한 감정 1개
2. secondary: 함께 느껴지는 감정 최대 2개 (없으면 빈 배열)
3. intensity: 감정의 강도 (0=매우 약함, 100=매우 강함)
4. triggerWords: 감정을 유발한 핵심 단어/구절 (최대 5개)

텍스트: ${text}`;

  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { 
          role: 'system', 
          content: `You are an advanced emotion analyzer that detects multiple emotions simultaneously.
Return only valid JSON with no additional text.`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });
    
    const raw = resp.choices?.[0]?.message?.content || '{}';
    console.log('🌈 복합 감정 분석 응답:', raw);
    
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    
    // Primary 감정 처리
    const primaryEmotion = parsed.primary?.emotion || defaultEmotion;
    const primaryScore = Math.max(0, Math.min(100, Number(parsed.primary?.score) || 50));
    const primaryIntensity = Math.max(0, Math.min(100, Number(parsed.primary?.intensity) || 50));
    const primaryColor = EMOTION_COLORS[primaryEmotion] || EMOTION_COLORS[defaultEmotion] || '#A8E6CF';
    
    const primary: EmotionDetail = {
      emotion: primaryEmotion,
      score: primaryScore,
      color: primaryColor,
      intensity: primaryIntensity
    };
    
    // Secondary 감정들 처리
    const secondary: EmotionDetail[] = (parsed.secondary || [])
      .slice(0, 2) // 최대 2개
      .map((s: any) => ({
        emotion: s.emotion || defaultEmotion,
        score: Math.max(0, Math.min(100, Number(s.score) || 30)),
        color: EMOTION_COLORS[s.emotion] || EMOTION_COLORS[defaultEmotion] || '#A8E6CF',
        intensity: Math.max(0, Math.min(100, Number(s.intensity) || 30))
      }));
    
    // 트리거 단어 추출
    const triggerWords: string[] = (parsed.triggerWords || [])
      .slice(0, 5) // 최대 5개
      .map((w: any) => String(w).trim())
      .filter((w: string) => w.length > 0);
    
    // 추세 계산 (이전 감정 데이터가 있으면)
    let trend: 'improving' | 'stable' | 'declining' | undefined;
    if (previousMoods && previousMoods.length > 0) {
      trend = calculateEmotionTrend(primaryEmotion, primaryIntensity, previousMoods);
    }
    
    const result: EnhancedMoodResult = {
      primary,
      secondary,
      trend,
      triggerWords,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ 복합 감정 분석 완료:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (e) {
    console.error('❌ 복합 감정 분석 오류:', e);
    // Fallback
    return {
      primary: {
        emotion: defaultEmotion,
        score: 50,
        color: EMOTION_COLORS[defaultEmotion] || '#A8E6CF',
        intensity: 50
      },
      secondary: [],
      triggerWords: [],
      timestamp: new Date().toISOString()
    };
  }
}

// 감정 추세 계산 함수
function calculateEmotionTrend(
  currentEmotion: string,
  currentIntensity: number,
  previousMoods: any[]
): 'improving' | 'stable' | 'declining' {
  // 최근 3개 감정 데이터 분석
  const recent = previousMoods.slice(-3);
  
  // 긍정적 감정 목록
  const positiveEmotions = ['기쁨', '행복', '평온/안도', '만족', '감사', '설렘', '희망'];
  const negativeEmotions = ['슬픔', '우울', '화남', '짜증', '불안', '스트레스', '외로움', '후회'];
  
  // 현재 감정이 긍정적인지 판단
  const isCurrentPositive = positiveEmotions.some(e => currentEmotion.includes(e));
  
  // 이전 감정들의 긍정도 계산
  let previousPositiveCount = 0;
  for (const mood of recent) {
    const emotion = mood.emotion || mood.primary?.emotion || '';
    if (positiveEmotions.some(e => emotion.includes(e))) {
      previousPositiveCount++;
    }
  }
  
  const positiveRatio = previousPositiveCount / recent.length;
  
  if (isCurrentPositive && positiveRatio < 0.5) {
    return 'improving'; // 부정 → 긍정
  } else if (!isCurrentPositive && positiveRatio > 0.5) {
    return 'declining'; // 긍정 → 부정
  } else {
    return 'stable'; // 유지
  }
}

// -------- Feedback endpoints --------
// POST /api/feedback/color { text, emotion, colorHex, accepted, correctedColorHex? }
app.post('/api/feedback/color', authMiddleware, async (req: any, res) => {
  try{
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const body = req.body || {};
  const emotion = normalizeEmotionKey(String(body.emotion||''));
    const colorHex = String(body.colorHex||'').trim();
    const accepted = Boolean(body.accepted);
    const correctedColorHex = body.correctedColorHex ? String(body.correctedColorHex).trim() : null;
    if(!emotion || !/^#?[0-9a-fA-F]{6}$/.test(colorHex.replace('#',''))) return res.status(400).json({ ok:false, message:'입력값 오류' });
  const doc = { userId, emotion, colorHex: colorHex.startsWith('#')?colorHex:`#${colorHex}`, accepted, correctedColorHex: correctedColorHex? (correctedColorHex.startsWith('#')?correctedColorHex:`#${correctedColorHex}`) : null, createdAt: new Date() };
    await db.collection('emotion_color_feedback').insertOne(doc);
    res.status(201).json({ ok:true });
  }catch(e){ res.status(500).json({ ok:false, message:'피드백 저장 오류' }); }
});

// GET /api/mood/palette -> 최근 개인 팔레트 프리뷰
app.get('/api/mood/palette', authMiddleware, async (req:any,res)=>{
  try{
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
  const emotions = [...CANONICAL_EMOTIONS];
    const items = [] as any[];
    for(const emo of emotions){
      const base = EMOTION_COLORS[emo];
      const personalized = await personalizedColorForEmotion(db, userId, base, emo);
      items.push({ emotion: emo, base, personalized });
    }
    res.json({ ok:true, items });
  }catch{ res.status(500).json({ ok:false, message:'팔레트 조회 오류' }); }
});

// GET /api/diary/list -> 최근 순 목록
app.get('/api/diary/list', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const diaries = await db
      .collection('diaries')
      .find({ userId })
      .project({ userId: 0 })
      .sort({ lastUpdatedAt: -1 })
      .limit(200)
      .toArray();

    // 각 다이어리의 마지막 사용자 메시지 미리보기(선택 사항)
    const ids = diaries.map((d: any) => d._id);
    const previews = await db
      .collection('diary_messages')
      .aggregate([
        { $match: { diaryId: { $in: ids } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$diaryId', last: { $first: '$$ROOT' } } },
      ])
      .toArray();
    const map = new Map<string, any>();
    for (const p of previews) map.set(String(p._id), p.last);
    const items = diaries.map((d: any) => ({
      _id: d._id,
      date: d.date,
      mood: d.mood || null,
      lastUpdatedAt: d.lastUpdatedAt,
      preview: (map.get(String(d._id))?.content || '').slice(0, 80),
    }));
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ message: '다이어리 목록 조회 오류' });
  }
});

// GET /api/diary/:date -> 해당 날짜의 문서와 메시지
app.get('/api/diary/:date(\\d{4}-\\d{2}-\\d{2})', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const dateKey = String(req.params.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ message: 'date 형식은 YYYY-MM-DD' });

    const diary = await getOrCreateDiary(db, userId, dateKey);
    const msgs = await db
      .collection('diary_messages')
      .find({ diaryId: diary._id })
      .sort({ createdAt: 1 })
      .project({ diaryId: 0, userId: 0 })
      .toArray();
    res.json({ ok: true, diary: { id: String(diary._id), date: diary.date, title: diary.title || '', mood: diary.mood, lastUpdatedAt: diary.lastUpdatedAt }, messages: msgs.map(m => ({ id: String(m._id), role: m.role, content: m.content, createdAt: m.createdAt })) });
  } catch (e) {
    res.status(500).json({ message: '다이어리 조회 오류' });
  }
});

// POST /api/diary/:date/chat { text }
//   - 유저 메시지를 저장하고, AI 응답 생성 후 저장
//   - 감정/색 탐지 후 다이어리 문서 업데이트
app.post('/api/diary/:date(\\d{4}-\\d{2}-\\d{2})/chat', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    const { text } = req.body || {};
    const dateKey = String(req.params.date || '').trim();
    if (!text || typeof text !== 'string') return res.status(400).json({ message: 'text가 필요합니다.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ message: 'date 형식은 YYYY-MM-DD' });

    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const diary = await getOrCreateDiary(db, userId, dateKey);

    // 1) 유저 메시지 저장
    const userDoc = { diaryId: diary._id, userId, role: 'user', content: text, createdAt: new Date() };
    await db.collection('diary_messages').insertOne(userDoc);

    // 2) 최근 메시지 20개로 컨텍스트 구성
    const history = await db
      .collection('diary_messages')
      .find({ diaryId: diary._id })
      .sort({ createdAt: 1 })
      .toArray();
    const messages = [
      { role: 'system', content: '당신은 공감적이고 상냥한 상담 동반자입니다. 짧고 따뜻하게, 한국어로 답하세요.' },
      ...history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    // 3) AI 응답 생성
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const completion = await chatCompletionWithFallback(openai, messages);
    const reply = completion.choices?.[0]?.message?.content || '';

    // 4) 응답 저장
    const asstDoc = { diaryId: diary._id, userId, role: 'assistant', content: reply, createdAt: new Date() };
    await db.collection('diary_messages').insertOne(asstDoc);

    // 5) 감정/색 감지 (최신 사용자 메시지 기반)
    const mood = await detectEmotionFromText(text);
    const personalizedColor = await personalizedColorForEmotion(db, userId, mood.color, mood.emotion);
    const finalMood = { ...mood, color: personalizedColor };
    await db.collection('diaries').updateOne(
      { _id: diary._id },
      { $set: { mood: finalMood, lastUpdatedAt: new Date() } }
    );

    res.status(201).json({ ok: true, user: userDoc, assistant: asstDoc, mood: finalMood });
  } catch (e) {
    console.error('diary chat error:', (e as Error).message);
    res.status(500).json({ message: '다이어리 채팅 처리 오류' });
  }
});

// -----------------------
// Session-based endpoints
// -----------------------

type DiarySession = {
  _id?: any;
  userId: string;
  date: string; // YYYY-MM-DD
  title?: string;
  type?: 'ai' | 'online'; // 세션 타입: AI 대화 또는 온라인 채팅
  mood?: { emotion: string; score: number; color: string } | null;
  createdAt: Date;
  lastUpdatedAt: Date;
};

// POST /api/diary/session { date? }
app.post('/api/diary/session', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const date = (req.body?.date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)) ? req.body.date : toDateKey(new Date());
    const type = (req.body?.type === 'online') ? 'online' : 'ai'; // 기본값: ai
    const title = String(req.body?.title || '').slice(0, 100);
    const doc: DiarySession = { userId, date, title, type, mood: null, createdAt: new Date(), lastUpdatedAt: new Date() };
    const r = await db.collection('diary_sessions').insertOne(doc);
    res.status(201).json({ ok: true, id: String(r.insertedId) });
  } catch (e) {
    res.status(500).json({ message: '세션 생성 오류' });
  }
});

// GET /api/diary/sessions?type=ai|online (type 필터 선택 가능)
app.get('/api/diary/sessions', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const typeFilter = req.query.type;
    const query: any = { userId };
    
    // type 필터가 있으면 적용
    if (typeFilter === 'ai') {
      // AI 대화: type이 'ai'이거나 type이 없는 것(기존 세션)
      query.$or = [{ type: 'ai' }, { type: { $exists: false } }, { type: null }];
    } else if (typeFilter === 'online') {
      // 온라인 채팅: type이 정확히 'online'인 것만
      query.type = 'online';
    }
    
    console.log('📋 세션 목록 조회:', { userId, typeFilter, query: JSON.stringify(query) });
    
    const sessions = await db
      .collection('diary_sessions')
      .find(query)
      .sort({ lastUpdatedAt: -1 })
      .limit(300)
      .toArray();
    
    console.log(`✅ 조회된 세션 수: ${sessions.length}`, sessions.map((s: any) => ({ _id: s._id, type: s.type, title: s.title?.slice(0, 30) })));
    // preview
    const ids = sessions.map((s: any) => s._id);
    const previews = await db.collection('diary_session_messages').aggregate([
      { $match: { sessionId: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$sessionId', last: { $first: '$$ROOT' } } },
    ]).toArray();
    const map = new Map<string, any>();
    for (const p of previews) map.set(String(p._id), p.last);
    res.json({ ok: true, items: sessions.map((s: any) => ({
      _id: String(s._id), date: s.date, title: s.title || '', type: s.type, mood: s.mood || null, lastUpdatedAt: s.lastUpdatedAt,
      preview: (map.get(String(s._id))?.content || '').slice(0, 80),
    })) });
  } catch (e) {
    res.status(500).json({ message: '세션 목록 조회 오류' });
  }
});

// GET /api/diary/session/:id
app.get('/api/diary/session/:id', authMiddleware, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const session = await db.collection('diary_sessions').findOne({ _id: new ObjectId(id), userId });
    if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
    const msgs = await db
      .collection('diary_session_messages')
      .find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .toArray();
    
    // 온라인 채팅 세션인데 originalMessageCount가 없으면 자동 설정
    let originalCount = session.originalMessageCount || 0;
    if (session.type === 'online' && !session.originalMessageCount && msgs.length > 0) {
      // 자동요약 메시지를 찾아서 그 전까지를 원본으로 처리
      const summaryIndex = msgs.findIndex((m: any) => 
        m.role === 'user' && m.content && m.content.startsWith('[자동요약]')
      );
      originalCount = summaryIndex >= 0 ? summaryIndex : msgs.length;
      
      // DB 업데이트
      await db.collection('diary_sessions').updateOne(
        { _id: session._id },
        { $set: { originalMessageCount: originalCount } }
      );
    }
    
    res.json({ 
      ok: true, 
      session: { 
        id: String(session._id), 
        date: session.date, 
        title: session.title || '', 
        type: session.type || 'ai', 
        mood: session.mood || null, 
        originalMessageCount: originalCount, 
        summary: session.summary || '',
        memo: session.memo || '',
        lastUpdatedAt: session.lastUpdatedAt 
      }, 
      messages: msgs.map(m => ({ 
        id: String(m._id), 
        role: m.role, 
        content: m.content, 
        createdAt: m.createdAt 
      })) 
    });
  } catch (e) {
    res.status(500).json({ message: '세션 조회 오류' });
  }
});

// POST /api/diary/session/:id/chat { text }
app.post('/api/diary/session/:id/chat', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    const id = String(req.params.id || '').trim();
    const text = String(req.body?.text || '');
    if (!ObjectId.isValid(id) || !text) return res.status(400).json({ message: '입력값 오류' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const session = await db.collection('diary_sessions').findOne({ _id: new ObjectId(id), userId });
    if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
    
    // save user msg
    await db.collection('diary_session_messages').insertOne({ sessionId: session._id, userId, role: 'user', content: text, createdAt: new Date() });
    const history = await db.collection('diary_session_messages').find({ sessionId: session._id }).sort({ createdAt: 1 }).toArray();
    const messages = [
      { role: 'system', content: '당신은 공감적이고 상냥한 상담 동반자입니다. 짧고 따뜻하게, 한국어로 답하세요.' },
      ...history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
    ];
    
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const completion = await chatCompletionWithFallback(openai, messages);
    const rawReply = completion.choices?.[0]?.message?.content || '';
    
    // AI 응답에서 {"color":"#..."} 추출
    let extractedColor: string | null = null;
    let cleanReply = rawReply;
    const colorMatch = rawReply.match(/\{"color"\s*:\s*"(#[0-9a-fA-F]{6})"\}/);
    if (colorMatch) {
      extractedColor = colorMatch[1];
      cleanReply = rawReply.replace(colorMatch[0], '').trim();
      console.log('🎨 AI가 선택한 색상:', extractedColor);
    }
    
    await db.collection('diary_session_messages').insertOne({ sessionId: session._id, userId, role: 'assistant', content: cleanReply, createdAt: new Date() });
    
    // 감정 분석: 사용자 메시지만 카운트
    let finalMood = session.mood || null;
    const userMessages = history.filter((m: any) => m.role === 'user');
    const userMessageCount = userMessages.length + 1; // 방금 추가한 사용자 메시지 포함
    const minMessages = 5;
    
    console.log('📊 메시지 카운트:', {
      userMessageCount,
      minMessages,
      canAnalyze: userMessageCount >= minMessages
    });
    
    // 사용자 메시지가 5개 이상일 때만 감정 분석
    if (userMessageCount >= minMessages) {
      // 최근 5개 사용자 메시지만 분석 (Chat.tsx와 일관성 유지)
      const recentUserMessages = [...userMessages, { content: text }]
        .slice(-5)
        .map((m: any) => m.content)
        .join(' ');
      
      console.log('📝 Diary 세션 감정 분석:', {
        totalMessages: userMessageCount,
        analyzingCount: Math.min(5, userMessageCount),
        textPreview: recentUserMessages.slice(-100)
      });
      
      const mood = await detectEmotionFromText(recentUserMessages);
      
      // AI가 색상을 제공했다면 사용, 아니면 감정 분석 색상 사용
      const finalColor = extractedColor || (await personalizedColorForEmotion(db, userId, mood.color, mood.emotion));
      finalMood = { ...mood, color: finalColor };
      
      console.log('✨ 최종 감정:', finalMood);
      
      await db.collection('diary_sessions').updateOne(
        { _id: session._id }, 
        { $set: { mood: finalMood, lastUpdatedAt: new Date() } }
      );
    } else {
      // 최소 사용자 메시지 미만인 경우 타임스탬프만 업데이트
      await db.collection('diary_sessions').updateOne(
        { _id: session._id }, 
        { $set: { lastUpdatedAt: new Date() } }
      );
    }
    
    res.status(201).json({ 
      ok: true, 
      assistant: { content: cleanReply }, 
      mood: finalMood,
      messageCount: userMessageCount,
      minRequired: minMessages,
      canAnalyze: userMessageCount >= minMessages,
      extractedColor: extractedColor // 디버깅용
    });
  } catch (e: any) {
    console.error('session chat error:', e?.message || e);
    res.status(500).json({ message: '세션 채팅 처리 오류' });
  }
});

// POST /api/diary/session/:id/analyze - 수동 감정 분석 (최소 메시지 수 없이)
app.post('/api/diary/session/:id/analyze', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const session = await db.collection('diary_sessions').findOne({ _id: new ObjectId(id), userId });
    if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
    
    // 최소 2개 메시지 필요 (1턴)
    const history = await db.collection('diary_session_messages')
      .find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .toArray();
    
    if (history.length < 2) {
      return res.status(400).json({ message: '최소 1턴(2개 메시지) 이상 대화가 필요합니다.' });
    }
    
    // 최근 5개 사용자 메시지만 분석 (일관성 유지)
    const userMessages = history.filter((m: any) => m.role === 'user');
    const recentUserMessages = userMessages
      .slice(-5)
      .map((m: any) => m.content)
      .join(' ');
    
    console.log('📝 수동 감정 분석:', {
      totalMessages: userMessages.length,
      analyzingCount: Math.min(5, userMessages.length),
      textPreview: recentUserMessages.slice(-100)
    });
    
    // 최근 대화를 기반으로 감정 분석
    const mood = await detectEmotionFromText(recentUserMessages);
    const personalizedColor = await personalizedColorForEmotion(db, userId, mood.color, mood.emotion);
    const finalMood = { ...mood, color: personalizedColor };
    
    await db.collection('diary_sessions').updateOne(
      { _id: session._id }, 
      { $set: { mood: finalMood, lastUpdatedAt: new Date() } }
    );
    
    console.log('✅ 수동 분석 완료:', finalMood);
    
    res.status(200).json({ 
      ok: true, 
      mood: finalMood,
      messageCount: userMessages.length
    });
  } catch (e: any) {
    console.error('manual analyze error:', e?.message || e);
    res.status(500).json({ message: '감정 분석 오류' });
  }
});

// PATCH /api/diary/session/:id { title, memo }
app.patch('/api/diary/session/:id', authMiddleware, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    
    const updateFields: any = { lastUpdatedAt: new Date() };
    
    // title이 있으면 업데이트
    if (req.body?.title !== undefined) {
      updateFields.title = String(req.body.title).slice(0, 100);
    }
    
    // memo가 있으면 업데이트
    if (req.body?.memo !== undefined) {
      updateFields.memo = String(req.body.memo);
    }
    
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const r = await db.collection('diary_sessions').updateOne(
      { _id: new ObjectId(id), userId }, 
      { $set: updateFields }
    );
    if (!r.matchedCount) return res.status(404).json({ message: '세션 없음' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '세션 업데이트 오류' });
  }
});

// DELETE /api/diary/session/:id/messages (clear all)
app.delete('/api/diary/session/:id/messages', authMiddleware, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    await db.collection('diary_session_messages').deleteMany({ sessionId: new ObjectId(id), userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '세션 대화 삭제 오류' });
  }
});

// DELETE /api/diary/session/:id/messages/:mid
app.delete('/api/diary/session/:id/messages/:mid', authMiddleware, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const mid = String(req.params.mid || '').trim();
    if (!ObjectId.isValid(id) || !ObjectId.isValid(mid)) return res.status(400).json({ message: '유효하지 않은 ID' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const r = await db.collection('diary_session_messages').deleteOne({ _id: new ObjectId(mid), sessionId: new ObjectId(id), userId });
    if (!r.deletedCount) return res.status(404).json({ message: '메시지 없음' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '세션 메시지 삭제 오류' });
  }
});

// POST /api/diary/session/:id/import { messages: [{ role, content }, ...] }
// Chat.tsx에서 완료된 대화를 다이어리로 가져오기
app.post('/api/diary/session/:id/import', authMiddleware, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const messages = req.body?.messages;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 세션 ID' });
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ message: 'messages 배열이 필요합니다.' });
    
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    
    // 세션 존재 확인
    const session = await db.collection('diary_sessions').findOne({ _id: new ObjectId(id), userId });
    if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
    
    // 메시지들을 bulk insert
    const docs = messages
      .filter((m: any) => m.role && m.content && (m.role === 'user' || m.role === 'assistant'))
      .map((m: any) => ({
        sessionId: session._id,
        userId,
        role: m.role,
        content: String(m.content),
        createdAt: new Date()
      }));
    
    if (docs.length === 0) return res.status(400).json({ message: '유효한 메시지가 없습니다.' });
    
    await db.collection('diary_session_messages').insertMany(docs);
    
    // 온라인 채팅 세션인 경우, 원본 메시지 개수 저장
    if (session.type === 'online') {
      await db.collection('diary_sessions').updateOne(
        { _id: session._id },
        { $set: { originalMessageCount: docs.length } }
      );
    }
    
    // 마지막 사용자 메시지로 감정 분석
    const lastUserMsg = messages.filter((m: any) => m.role === 'user').slice(-1)[0];
    if (lastUserMsg?.content) {
      const mood = await detectEmotionFromText(lastUserMsg.content);
      const personalizedColor = await personalizedColorForEmotion(db, userId, mood.color, mood.emotion);
      const finalMood = { ...mood, color: personalizedColor };
      await db.collection('diary_sessions').updateOne(
        { _id: session._id },
        { $set: { mood: finalMood, lastUpdatedAt: new Date() } }
      );
      return res.status(201).json({ ok: true, imported: docs.length, mood: finalMood });
    }
    
    await db.collection('diary_sessions').updateOne({ _id: session._id }, { $set: { lastUpdatedAt: new Date() } });
    res.status(201).json({ ok: true, imported: docs.length });
  } catch (e: any) {
    console.error('import error:', e?.message || e);
    res.status(500).json({ message: '메시지 가져오기 오류' });
  }
});

// POST /api/diary/session/:id/summarize - 대화 내용 요약
app.post('/api/diary/session/:id/summarize', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    
    // 세션 확인
    const session = await db.collection('diary_sessions').findOne({ _id: new ObjectId(id), userId });
    if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
    
    // 이미 요약이 있으면 반환
    if (session.summary) {
      return res.status(200).json({ ok: true, summary: session.summary });
    }
    
    // 모든 메시지 가져오기
    const messages = await db.collection('diary_session_messages')
      .find({ sessionId: new ObjectId(id), userId })
      .sort({ createdAt: 1 })
      .toArray();
    
    if (messages.length === 0) {
      return res.status(400).json({ message: '요약할 메시지가 없습니다.' });
    }
    
    // 대화 내용을 텍스트로 변환
    const conversationText = messages
      .map((m: any) => `${m.role === 'user' ? '사용자' : '상대방'}: ${m.content}`)
      .join('\n');
    
    // AI에게 요약 요청
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const summaryMessages = [
      {
        role: 'system',
        content: `당신은 대화 내용을 요약하는 전문가입니다. 
주어진 대화를 읽고 다음 사항을 포함하여 3-5문장으로 요약해주세요:
1. 대화의 주요 주제와 내용
2. 사용자가 표현한 감정이나 고민
3. 대화의 주요 흐름이나 결론

자연스럽고 공감적인 톤으로 작성하되, 핵심만 간결하게 전달해주세요.`
      },
      {
        role: 'user',
        content: `다음 대화를 요약해주세요:\n\n${conversationText}`
      }
    ];
    
    const completion = await chatCompletionWithFallback(openai, summaryMessages);
    const summary = completion.choices?.[0]?.message?.content || '요약을 생성할 수 없습니다.';
    
    // 요약 저장
    await db.collection('diary_sessions').updateOne(
      { _id: new ObjectId(id) },
      { $set: { summary, lastUpdatedAt: new Date() } }
    );
    
    console.log('✅ 대화 요약 완료:', summary);
    
    res.status(200).json({ ok: true, summary });
  } catch (e: any) {
    console.error('summarize error:', e?.message || e);
    res.status(500).json({ message: '요약 생성 오류' });
  }
});

// POST /api/diary/session/:id/continue
app.post('/api/diary/session/:id/continue', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const history = await db.collection('diary_session_messages').find({ sessionId: new ObjectId(id), userId }).sort({ createdAt: 1 }).toArray();
    const messages = [
      { role: 'system', content: '당신은 공감적이고 상냥한 상담 동반자입니다. 한국어로 부드럽게 이어서 말하세요.' },
      ...history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: '조금만 더 이야기해 줄래?' },
    ];
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const completion = await chatCompletionWithFallback(openai, messages);
    const reply = completion.choices?.[0]?.message?.content || '';
    await db.collection('diary_session_messages').insertOne({ sessionId: new ObjectId(id), userId, role: 'assistant', content: reply, createdAt: new Date() });
    await db.collection('diary_sessions').updateOne({ _id: new ObjectId(id) }, { $set: { lastUpdatedAt: new Date() } });
    res.status(201).json({ ok: true, assistant: { content: reply } });
  } catch (e: any) {
    console.error('session continue error:', e?.message || e);
    res.status(500).json({ message: '세션 추가 생성 오류' });
  }
});

// DELETE /api/diary/session/:id — delete a session and all its messages
app.delete('/api/diary/session/:id', authMiddleware, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const session = await db.collection('diary_sessions').findOne({ _id: new ObjectId(id), userId });
    if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
    await db.collection('diary_session_messages').deleteMany({ sessionId: new ObjectId(id), userId });
    await db.collection('diary_sessions').deleteOne({ _id: new ObjectId(id), userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '세션 삭제 오류' });
  }
});

// PATCH /api/diary/:date { title }
app.patch('/api/diary/:date(\\d{4}-\\d{2}-\\d{2})', authMiddleware, async (req: any, res) => {
  try {
    const dateKey = String(req.params.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ message: 'date 형식은 YYYY-MM-DD' });
    const title = String((req.body?.title ?? '')).slice(0, 100);
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const diary = await getOrCreateDiary(db, userId, dateKey);
    await db.collection('diaries').updateOne({ _id: diary._id }, { $set: { title, lastUpdatedAt: new Date() } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '제목 업데이트 오류' });
  }
});

// DELETE /api/diary/:date/messages — clear all messages for date
app.delete('/api/diary/:date(\\d{4}-\\d{2}-\\d{2})/messages', authMiddleware, async (req: any, res) => {
  try {
    const dateKey = String(req.params.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ message: 'date 형식은 YYYY-MM-DD' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const diary = await getOrCreateDiary(db, req.user.sub, dateKey);
    await db.collection('diary_messages').deleteMany({ diaryId: diary._id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '대화 삭제 오류' });
  }
});

// DELETE /api/diary/:date/messages/:id — delete one message
app.delete('/api/diary/:date(\\d{4}-\\d{2}-\\d{2})/messages/:id', authMiddleware, async (req: any, res) => {
  try {
    const dateKey = String(req.params.date || '').trim();
    const id = String(req.params.id || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ message: 'date 형식은 YYYY-MM-DD' });
    if (!id || !ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 메시지 ID' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const diary = await getOrCreateDiary(db, req.user.sub, dateKey);
    const r = await db.collection('diary_messages').deleteOne({ _id: new ObjectId(id), diaryId: diary._id });
    if (r.deletedCount === 0) return res.status(404).json({ message: '메시지를 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '메시지 삭제 오류' });
  }
});

// POST /api/diary/:date/continue — generate an additional assistant reply
app.post('/api/diary/:date/continue', authMiddleware, async (req: any, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ message: 'OPENAI_API_KEY 미설정' });
    const dateKey = String(req.params.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return res.status(400).json({ message: 'date 형식은 YYYY-MM-DD' });
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const diary = await getOrCreateDiary(db, userId, dateKey);

    const history = await db
      .collection('diary_messages')
      .find({ diaryId: diary._id })
      .sort({ createdAt: 1 })
      .toArray();
    const messages = [
      { role: 'system', content: '당신은 공감적이고 상냥한 상담 동반자입니다. 한국어로 부드럽고 짧게 이어서 말하세요.' },
      ...history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: '조금만 더 이야기해 줄래?' },
    ];
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({ model: OPENAI_MODEL, messages, temperature: 0.7 });
    const reply = completion.choices?.[0]?.message?.content || '';
    const asstDoc = { diaryId: diary._id, userId, role: 'assistant', content: reply, createdAt: new Date() };
    await db.collection('diary_messages').insertOne(asstDoc);
    res.status(201).json({ ok: true, assistant: { content: reply } });
  } catch (e) {
    res.status(500).json({ message: '추가 생성 중 오류' });
  }
});

// Debug: database info (DEV only)
app.get('/api/debug/db-info', async (_req, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const usersCount = await db.collection('users').countDocuments({});
    const messagesCount = await db.collection('messages').countDocuments({});
    res.json({ ok: true, dbName: DB_NAME, counts: { users: usersCount, messages: messagesCount } });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'debug info error' });
  }
});

app.get('/api/debug/list-dbs', async (_req, res) => {
  try {
    const client = await getClient();
    const admin = client.db('admin');
    const dbs = await admin.admin().listDatabases();
    res.json({ ok: true, databases: dbs.databases.map(d => ({ name: d.name, sizeOnDisk: d.sizeOnDisk })) });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'list dbs error' });
  }
});

app.get('/api/debug/list-collections', async (_req, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const cols = await db.listCollections().toArray();
    res.json({ ok: true, dbName: DB_NAME, collections: cols.map(c => c.name) });
  } catch (e) {
    res.status(500).json({ ok: false, message: 'list collections error' });
  }
});

// ----------------------- # 실시간 1대1 매칭 -시작- -----------------------
// 작성자: 송창하
// socket.io(실시간 통신)와 http 서버를 위한 모듈 가져오기
import { Server } from "socket.io";
import http from "http";

// 기존의 express 앱(app)을 http 서버로 감싸서 socket.io와 함께 사용 가능
const httpServer = http.createServer(app);

// socket.io 서버 생성
// cors를 *로 설정시 모든 도메인에서 접속 가능
const server = new Server(httpServer, { cors: { origin: "*" } });

// waitingUser: 현재 매칭을 기다리고 있는 사용자
let waitingUser: string | null = null;

// 방 별 사용자 관리를 위한 Map
const roomUsers = new Map<string, string[]>();

// ------------------------- # connection -시작- -------------------------
// 클라이언트 -> 서버 (connection)
server.on("connection", (client) => {

  // -log-
  console.log(`새 사용자 접속: ${client.id}`);

  // 클라이언트 -> 서버 (userDisconnect)
  client.on("userDisconnect", () => {
    // -log-
    console.log(`사용자 접속 종료: ${client.id}`);
    
    // 매칭 대기 중이던 사용자가 접속을 종료한 경우
    if (waitingUser === client.id) {

      // 대기열 비우기
      waitingUser = null;
    }
    
  });

  // ----------------- # startMatching -시작- -----------------
  // 클라이언트 -> 서버 (startMatching)
  client.on("startMatching", () => {

    // -log-
    console.log(`${client.id} 매칭 요청`)

    // 이미 매칭 대기 중인 다른 클라이언트가 있을 때 (1/2명 -> 2/2명)
    if (waitingUser) {

      // roomId: 두 클라이언트가 들어갈 방 ID 값
      const roomId = `${waitingUser}_${client.id}`;

      // 두 클라이언트를 roomId방 안에 넣기
      server.sockets.sockets.get(waitingUser)?.join(roomId);
      client.join(roomId);

      // 방 사용자 목록에 추가
      roomUsers.set(roomId, [waitingUser, client.id]);

      // (1번 이벤트 루프를 건너뛴 다음) 두 클라이언트에게 matched 이벤트 보내기 (1대1 채팅 매칭 성공)
      setTimeout(() => {
        server.to(roomId).emit("matched", { roomId, users: [waitingUser, client.id] });
      }, 0)

      // -log-
      console.log(`매칭 완료: ${waitingUser} - ${client.id}`);

      // 대기열 비우기
      waitingUser = null;

    }
    // 매칭 대기 중인 다른 클라이언트가 없을 때 (0/2명 -> 1/2명)
    else {

      // 현재 클라이언트를 대기열에 등록
      waitingUser = client.id;
    }
  })
  // ----------------- # startMatching -끝- -----------------

  // 클라이언트 -> 서버 (chat): 같은 방에 있는 사람에게 메시지 전달
  client.on("chat", async ({ roomId, user, text }) => {

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // OpenAI에게 메시지에 담긴 감정을 색상으로 변환해 달라고 하기
    const airesponse = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `사용자가 입력한 문장의 감정을 파악하고 감정에 어울리는 색상을 {"color":"#ffffff"} 형태로 만들어`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0
    });

    // aiContent: openai의 답변
    let aiContent = airesponse.choices[0].message.content;

    // json: aicontent에 포함한 json
    const jsonMatch = aiContent?.match(/\{[^}]+\}/);

    // 채팅 말풍선 색상 기본값
    let color = "#aaaaaa";

    // 만약 AI 메시지에서 json이 포함되어 있다면
    if (jsonMatch) {

      // AI 메시지에서 json 추출 시도
      const json = JSON.parse(jsonMatch[0]);

      // json에 color 속성이 있을 때
      if (json.color) {

        // 채팅 말풍선 색상 변경
        color = json.color;
      }
    }

    console.log(`${user}: ${text}`);

    // 해당 room에 속한 모든 클라이언트에게 메시지 전송
    server.to(roomId).emit("chat", { user, text, color });
  }
  );

  // 클라이언트 -> 서버 (disconnect): 연결 종료
  client.on("disconnect", () => {
    // -log-
    console.log(`연결 종료: ${client.id}`);

    // 만약 대기열에 있던 클라이언트라면 대기열 비우기
    if (client.id == waitingUser) {
      waitingUser = null;
    }

    // 사용자가 속한 방을 찾아서 처리
    for (const [roomId, users] of roomUsers.entries()) {
      if (users.includes(client.id)) {
        // 남은 사용자에게 상대방 연결 종료 알림
        const otherUser = users.find(id => id !== client.id);
        if (otherUser) {
          server.to(otherUser).emit("userLeft", { 
            message: "상대방이 대화방을 나갔습니다." 
          });
        }
        // 방 목록에서 제거
        roomUsers.delete(roomId);
        break;
      }
    }
  });

});

// ------------------------- # connection -끝- -------------------------
// ----------------------- # 실시간 1대1 매칭 -끝- -----------------------

// Start only after confirming DB readiness
(async () => {
  try {
    const client = await getClient();
    await client.db('admin').command({ ping: 1 });
    await ensureIndexes();
    httpServer.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT} (db: ${DB_NAME})`);
    });
  } catch (e) {
    console.error('서버 시작 실패: DB 연결 확인 필요:', (e as Error).message);
    process.exit(1);
  }
})();
