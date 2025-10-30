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

const EMOTION_COLORS: Record<string, string> = {
  joy: '#FFD166',
  sad: '#118AB2',
  anger: '#EF476F',
  fear: '#073B4C',
  anxious: '#06D6A0',
  neutral: '#A8A8A8',
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
    const fb = await db.collection('emotion_color_feedback')
      .find({ userId, emotion })
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
    const emotion = String(body.emotion||'').toLowerCase();
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
    const emotions = Object.keys(EMOTION_COLORS);
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
    const doc: DiarySession = { userId, date, title: '', mood: null, createdAt: new Date(), lastUpdatedAt: new Date() };
    const r = await db.collection('diary_sessions').insertOne(doc);
    res.status(201).json({ ok: true, id: String(r.insertedId) });
  } catch (e) {
    res.status(500).json({ message: '세션 생성 오류' });
  }
});

// GET /api/diary/sessions
app.get('/api/diary/sessions', authMiddleware, async (req: any, res) => {
  try {
    const client = await getClient();
    const db = client.db(DB_NAME);
    const userId = req.user.sub;
    const sessions = await db
      .collection('diary_sessions')
      .find({ userId })
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
      _id: String(s._id), date: s.date, title: s.title || '', mood: s.mood || null, lastUpdatedAt: s.lastUpdatedAt,
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
    const reply = completion.choices?.[0]?.message?.content || '';
    await db.collection('diary_session_messages').insertOne({ sessionId: session._id, userId, role: 'assistant', content: reply, createdAt: new Date() });
  const mood = await detectEmotionFromText(text);
  const personalizedColor = await personalizedColorForEmotion(db, userId, mood.color, mood.emotion);
  const finalMood = { ...mood, color: personalizedColor };
  await db.collection('diary_sessions').updateOne({ _id: session._id }, { $set: { mood: finalMood, lastUpdatedAt: new Date() } });
  res.status(201).json({ ok: true, assistant: { content: reply }, mood: finalMood });
  } catch (e: any) {
    console.error('session chat error:', e?.message || e);
    res.status(500).json({ message: '세션 채팅 처리 오류' });
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

// Start only after confirming DB readiness
(async () => {
  try {
    const client = await getClient();
    await client.db('admin').command({ ping: 1 });
    await ensureIndexes();
    app.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT} (db: ${DB_NAME})`);
    });
  } catch (e) {
    console.error('서버 시작 실패: DB 연결 확인 필요:', (e as Error).message);
    process.exit(1);
  }
})();
