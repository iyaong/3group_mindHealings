import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 환경변수: MONGO_URI(외부 IP 포함), DB_NAME, PORT
const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.DB_NAME || 'appdb';
const PORT = Number(process.env.PORT || 5174);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

if (!MONGO_URI) {
  console.error('MONGO_URI 환경변수가 필요합니다. 예: mongodb://USER:PASS@<EXTERNAL_IP>:27017/?authSource=admin');
}

const app = express();
app.use(cors());
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

app.get('/api/health', async (_req, res) => {
  try {
    const client = await getClient();
    await client.db('admin').command({ ping: 1 });
    res.json({ ok: true, db: 'up' });
  } catch {
    res.status(500).json({ ok: false, db: 'down' });
  }
});

app.listen(PORT, async () => {
  await ensureIndexes();
  console.log(`API server listening on http://localhost:${PORT}`);
});
