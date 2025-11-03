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

async function chatCompletionWithFallback(openai: OpenAI, messages: Array<{ role: string; content: string }>, primaryModel?: string) {
  const preferred = primaryModel || OPENAI_MODEL;
  try {
  return await openai.chat.completions.create({ model: preferred, messages: [
        ...messages.map((m: any) => ({ role: m.role, content: String(m.content) })),
        {
          role: 'system',
          content: `
            1. 다정하고 친근하게 말해줘
            2. (사용자 몰래, 사용자의 대화에서 감정이 느껴질 때) 대화 끝에 {"color":"#ffffff"} 형태의 JSON을 포함시켜줘
            color는 현재 사용자의 감정에 가장 어울리는 색상이야.
            color의 채도는 사용자의 감정이 격해질 수록 높아져.`
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
            2. (사용자 몰래, 사용자의 대화에서 감정이 느껴질 때) 대화 끝에 {"color":"#ffffff"} 형태의 JSON을 포함시켜줘
            color는 현재 사용자의 감정에 가장 어울리는 색상이야.
            color의 채도는 사용자의 감정이 격해질 수록 높아져.`
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
              // 1) 원본 키도 보관 (디버그/미사용 키 조회용)
              out[k] = HEX;
              // 2) 표준 감정 키로 정규화한 항목을 생성하여 기본 팔레트를 덮어씌움
              const canon = normalizeEmotionKey(k);
              out[canon] = HEX;
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
  // 간단 분류 프롬프트 (JSON 반환 기대)
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const prompt = `다음 한국어 텍스트의 주된 감정을 다음 목록 중 하나로 분류하고 0~100 강도로 점수를 주세요. 반드시 JSON으로만 답하세요.
감정 목록: joy, sad, anger, fear, anxious, neutral
출력 형식: {"emotion":"joy|sad|anger|fear|anxious|neutral","score":0..100}
텍스트: ${text}`;
  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that returns JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    });
    const raw = resp.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const emotion = (parsed.emotion || 'neutral').toLowerCase();
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
    return { emotion, score, color };
  } catch {
    return { emotion: 'neutral', score: 0, color: EMOTION_COLORS.neutral };
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
    
    const sessions = await db
      .collection('diary_sessions')
      .find(query)
      .sort({ lastUpdatedAt: -1 })
      .limit(300)
      .toArray();
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
    res.json({ ok: true, session: { id: String(session._id), date: session.date, title: session.title || '', mood: session.mood || null, lastUpdatedAt: session.lastUpdatedAt }, messages: msgs.map(m => ({ id: String(m._id), role: m.role, content: m.content, createdAt: m.createdAt })) });
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
    
    // 감정 분석: 매 메시지마다 업데이트 (AI가 준 색상 우선 사용)
    let finalMood = session.mood || null;
    const totalMessages = history.length + 1;
    const minMessages = 10;
    
    // AI가 색상을 제공했다면 즉시 사용
    if (extractedColor) {
      const allUserMessages = history
        .filter((m: any) => m.role === 'user')
        .map((m: any) => m.content)
        .join(' ');
      const mood = await detectEmotionFromText(allUserMessages);
      finalMood = { ...mood, color: extractedColor }; // AI가 준 색상 사용!
      console.log('✨ 최종 감정:', finalMood);
      
      await db.collection('diary_sessions').updateOne(
        { _id: session._id }, 
        { $set: { mood: finalMood, lastUpdatedAt: new Date() } }
      );
    } else if (totalMessages >= minMessages && !session.mood) {
      // AI가 색상을 안 줬고, 최소 메시지 이상이면 기존 로직 사용
      const allUserMessages = history
        .filter((m: any) => m.role === 'user')
        .map((m: any) => m.content)
        .join(' ');
      const mood = await detectEmotionFromText(allUserMessages);
      const personalizedColor = await personalizedColorForEmotion(db, userId, mood.color, mood.emotion);
      finalMood = { ...mood, color: personalizedColor };
      
      await db.collection('diary_sessions').updateOne(
        { _id: session._id }, 
        { $set: { mood: finalMood, lastUpdatedAt: new Date() } }
      );
    } else {
      // 분석 전이거나 이미 분석된 경우 타임스탬프만 업데이트
      await db.collection('diary_sessions').updateOne(
        { _id: session._id }, 
        { $set: { lastUpdatedAt: new Date() } }
      );
    }
    
    res.status(201).json({ 
      ok: true, 
      assistant: { content: cleanReply }, 
      mood: finalMood,
      messageCount: totalMessages,
      minRequired: minMessages,
      canAnalyze: totalMessages >= minMessages,
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
    
    // 전체 대화 내용을 하나의 텍스트로 결합
    const allUserMessages = history
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content)
      .join(' ');
    
    // 전체 대화 흐름을 기반으로 감정 분석
    const mood = await detectEmotionFromText(allUserMessages);
    const personalizedColor = await personalizedColorForEmotion(db, userId, mood.color, mood.emotion);
    const finalMood = { ...mood, color: personalizedColor };
    
    await db.collection('diary_sessions').updateOne(
      { _id: session._id }, 
      { $set: { mood: finalMood, lastUpdatedAt: new Date() } }
    );
    
    res.status(200).json({ 
      ok: true, 
      mood: finalMood,
      messageCount: history.length
    });
  } catch (e: any) {
    console.error('manual analyze error:', e?.message || e);
    res.status(500).json({ message: '감정 분석 오류' });
  }
});

// PATCH /api/diary/session/:id { title }
app.patch('/api/diary/session/:id', authMiddleware, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: '유효하지 않은 ID' });
    const title = String((req.body?.title ?? '')).slice(0, 100);
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const r = await db.collection('diary_sessions').updateOne({ _id: new ObjectId(id), userId }, { $set: { title, lastUpdatedAt: new Date() } });
    if (!r.matchedCount) return res.status(404).json({ message: '세션 없음' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: '세션 제목 업데이트 오류' });
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
      waitingUser = null;
    }
    
    // 해당 사용자가 속한 모든 방에서 퇴장 알림
    client.rooms.forEach((room) => {
      if (room !== client.id) {  // 자신의 룸이 아닌 경우에만
        client.to(room).emit("userLeft", { userId: client.id });
      }
    });
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
  client.on("chat", async ({ roomId, text }) => {

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

    console.log(color);

    // 해당 room에 속한 모든 클라이언트에게 메시지 전송
    server.to(roomId).emit("chat", { user: client.id, text, color });
  }
  );

  // 클라이언트 -> 서버 (disconnect): 연결 종료
  client.on("disconnect", () => {

    // -log-
    console.log(`연결 종료: ${client.id}`);

    // 만약 대기열에 있던 클라이언트라면 대기열 비우기
    if (client.id == waitingUser) waitingUser = null;
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
