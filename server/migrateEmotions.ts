// 영어 감정을 한글로 변환하는 마이그레이션 스크립트
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.MONGO_DB_NAME || 'myapp_3g';

if (!MONGO_URI) {
  console.error('❌ MONGO_URI가 설정되지 않았습니다.');
  process.exit(1);
}

// 영어 -> 한글 매핑
const emotionMapping: Record<string, string> = {
  'joy': '기쁨',
  'happy': '행복',
  'happiness': '행복',
  'sad': '슬픔',
  'sadness': '슬픔',
  'anger': '분노',
  'angry': '분노',
  'fear': '두려움',
  'scared': '두려움',
  'neutral': '평온',
  'calm': '평온',
  'love': '사랑/애정',
  'surprise': '놀람',
  'surprised': '놀람',
  'disgust': '경멸',
  'anxiety': '불안',
  'anxious': '불안',
  'worried': '걱정',
  'worry': '걱정',
  'tired': '피로',
  'fatigue': '무기력',
  'excited': '흥분/열정',
  'excitement': '흥분/열정',
  'lonely': '외로움',
  'loneliness': '외로움',
  'grateful': '감사',
  'gratitude': '감사',
};

// emotion_colors.json 로드
function loadEmotionColors(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), 'server/emotion_colors.json'),
    path.resolve(process.cwd(), 'emotion_colors.json'),
  ];
  
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      // ignore
    }
  }
  return {};
}

async function migrateEmotions() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB 연결 성공\n');
    
    const db = client.db(DB_NAME);
    const sessions = db.collection('diary_sessions');
    const emotionColors = loadEmotionColors();
    
    console.log('📊 로드된 감정 색상:', Object.keys(emotionColors).length, '개\n');
    
    // 영어 감정이 있는 세션 찾기
    const allSessions = await sessions.find({
      'mood.emotion': { $exists: true }
    }).toArray();
    
    console.log(`📝 총 ${allSessions.length}개의 세션 확인 중...\n`);
    
    let migratedCount = 0;
    let errors: string[] = [];
    
    for (const session of allSessions) {
      const emotion = session.mood?.emotion;
      if (!emotion) continue;
      
      // 한글이 포함되어 있으면 건너뛰기
      if (/[가-힣]/.test(emotion)) continue;
      
      // 영어 감정을 한글로 변환
      const koreanEmotion = emotionMapping[emotion.toLowerCase()];
      
      if (koreanEmotion) {
        // 색상 코드 가져오기
        const color = emotionColors[koreanEmotion] || session.mood.color;
        
        // 업데이트
        await sessions.updateOne(
          { _id: session._id },
          { 
            $set: { 
              'mood.emotion': koreanEmotion,
              'mood.color': color
            } 
          }
        );
        
        console.log(`✅ 변환: "${emotion}" → "${koreanEmotion}" (${color})`);
        migratedCount++;
      } else {
        errors.push(`⚠️  매핑 없음: "${emotion}" (세션 ID: ${session._id})`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 마이그레이션 완료');
    console.log('='.repeat(60));
    console.log(`✅ 총 변환: ${migratedCount}개`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  처리되지 않은 감정: ${errors.length}개`);
      errors.forEach(err => console.log(err));
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (e) {
    console.error('❌ 마이그레이션 실패:', e);
  } finally {
    await client.close();
  }
}

migrateEmotions();
