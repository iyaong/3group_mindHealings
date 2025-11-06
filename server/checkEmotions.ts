// 데이터베이스의 감정 데이터를 체크하는 스크립트
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'myapp_3g';

async function checkEmotions() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI가 설정되지 않았습니다.');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB 연결 성공');
    
    const db = client.db(DB_NAME);
    const sessions = db.collection('diary_sessions');
    
    // 모든 세션의 감정 데이터 조회
    const allSessions = await sessions.find({
      'mood.emotion': { $exists: true }
    }).toArray();
    
    console.log(`\n📊 총 ${allSessions.length}개의 감정 데이터 발견\n`);
    
    // 감정 통계
    const emotionCount: Record<string, number> = {};
    const uniqueEmotions = new Set<string>();
    
    allSessions.forEach(session => {
      const emotion = session.mood?.emotion;
      if (emotion) {
        uniqueEmotions.add(emotion);
        emotionCount[emotion] = (emotionCount[emotion] || 0) + 1;
      }
    });
    
    console.log('🎯 발견된 고유 감정들:\n');
    Array.from(uniqueEmotions).sort().forEach(emotion => {
      const count = emotionCount[emotion];
      const isKorean = /[가-힣]/.test(emotion);
      const marker = isKorean ? '✅' : '⚠️ ';
      console.log(`${marker} ${emotion} (${count}회)`);
    });
    
    // 영어 감정만 필터링
    const englishEmotions = Array.from(uniqueEmotions).filter(e => !/[가-힣]/.test(e));
    
    if (englishEmotions.length > 0) {
      console.log(`\n⚠️  영어 감정 ${englishEmotions.length}개 발견:`);
      englishEmotions.forEach(e => console.log(`   - ${e}`));
      console.log('\n💡 server/migrateEmotions.ts 스크립트로 수정할 수 있습니다.');
    } else {
      console.log('\n✅ 모든 감정이 한글입니다!');
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await client.close();
    console.log('\n✅ MongoDB 연결 종료');
  }
}

checkEmotions();
