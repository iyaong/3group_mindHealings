// migrateNicknames.ts
// 닉네임이 없는 기존 사용자에게 기본 닉네임을 부여하는 스크립트

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.DB_NAME || 'appdb';

async function migrateNicknames() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI가 설정되지 않았습니다.');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB 연결 성공');
    
    const db = client.db(DB_NAME);
    const users = db.collection('users');
    
    // 닉네임이 없는 사용자 찾기
    const usersWithoutNickname = await users.find({
      $or: [
        { nickname: { $exists: false } },
        { nickname: null },
        { nickname: '' }
      ]
    }).toArray();
    
    console.log(`\n📊 닉네임이 없는 사용자: ${usersWithoutNickname.length}명`);
    
    if (usersWithoutNickname.length === 0) {
      console.log('✅ 모든 사용자에게 닉네임이 설정되어 있습니다.');
      return;
    }
    
    let updatedCount = 0;
    
    for (const user of usersWithoutNickname) {
      const emailPrefix = user.email.split('@')[0];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const defaultNickname = `${emailPrefix}${randomSuffix}`;
      
      await users.updateOne(
        { _id: user._id },
        { $set: { nickname: defaultNickname } }
      );
      
      console.log(`✅ ${user.email} → ${defaultNickname}`);
      updatedCount++;
    }
    
    console.log(`\n🎉 총 ${updatedCount}명의 사용자 닉네임 업데이트 완료!`);
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ MongoDB 연결 종료');
  }
}

migrateNicknames();
