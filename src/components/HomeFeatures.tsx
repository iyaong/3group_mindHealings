// HomeFeatures.tsx
// 홈페이지 추가 기능 섹션들

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import CountUp from 'react-countup';
import { useInView } from 'react-intersection-observer';
import '../styles/HomeFeatures.css';

/* ===== 공통 애니메이션 설정 ===== */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 1, 0.3, 1] as const } },
};

const fadeDelay = (delay: number) => ({
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay, ease: [0.25, 1, 0.3, 1] as const },
  },
});

export default function HomeFeatures() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="home-features-container"
      initial="hidden"
      animate="visible"
      viewport={{ once: true }}
    >
      
      {/* 1. 서비스 소개 섹션 */}
      <motion.section
        className="service-intro-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <h2 className="service-intro-title">
          토닥톡과 함께하는 감정 여행
        </h2>
        <p className="service-intro-description">
          AI가 당신의 감정을 이해하고 분석합니다.<br />
          매일의 감정을 기록하고, 패턴을 발견하고, 더 나은 내일을 만들어가세요.
        </p>

        {/* 주요 특징 */}
        <motion.div
          className="features-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {[
            { icon: "🤖", title: "AI 감정 분석", description: "고도화된 AI가 당신의 감정을 정확하게 분석하고 인사이트를 제공합니다" },
            { icon: "📊", title: "감정 패턴 추적", description: "시간에 따른 감정 변화를 시각화하여 나를 더 깊이 이해할 수 있습니다" },
            { icon: "🔒", title: "완벽한 프라이버시", description: "당신의 일기는 안전하게 보호됩니다. 원하는 만큼만 공유하세요" },
            { icon: "💬", title: "따뜻한 커뮤니티", description: "비슷한 감정을 경험한 사람들과 익명으로 소통할 수 있습니다" },
          ].map((feature, i) => (
            <motion.div key={i} variants={fadeDelay(i * 0.2)}>
              <FeatureBox {...feature} />
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* 🌙 감정 스토리 섹션 - "마음의 순간들" */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <EmotionStorySection />
      </motion.div>

      {/* 2. 주요 기능 카드 */}
      <motion.section
        className="functions-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <div className="functions-container">
          <h2 className="functions-title">
            토닥톡의 주요 기능
          </h2>

          <motion.div
            className="functions-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              { icon: "📝", title: "다이어리", description: "오늘의 감정과 생각을 자유롭게 기록하세요. AI가 당신의 감정을 분석해드립니다.", path: '/diary' },
              { icon: "📈", title: "히스토리", description: "과거의 감정 기록을 달력과 차트로 한눈에 확인하고, 패턴을 발견하세요.", path: '/history' },
              { icon: "🎯", title: "목표", description: "감정 관리 목표를 설정하고 달성 과정을 추적하며 성장하세요.", path: '/goals' },
              { icon: "💬", title: "챗온", description: "다른 사용자들과 익명으로 감정을 공유하고 위로를 주고받으세요.", path: '/online' },
            ].map((func, i) => (
              <motion.div key={i} variants={fadeDelay(i * 0.2)}>
                <FunctionCard
                  icon={func.icon}
                  title={func.title}
                  description={func.description}
                  onClick={() => navigate(func.path)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* 3. 사용 방법 */}
      <motion.section
        className="steps-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <h2 className="steps-title">
          이렇게 시작하세요
        </h2>

        <motion.div
          className="steps-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {[
            { number: "1", title: "회원가입", description: "간단한 정보만 입력하면 바로 시작할 수 있어요", color: "blue" },
            { number: "2", title: "감정 기록", description: "오늘 하루의 감정과 이야기를 자유롭게 작성하세요", color: "purple" },
            { number: "3", title: "분석 & 성장", description: "AI 분석을 통해 나를 이해하고 더 나은 내일을 만들어가세요", color: "green" },
          ].map((step, i) => (
            <motion.div key={i} variants={fadeDelay(i * 0.2)}>
              <StepCard {...step} />
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* 4. 통계 섹션 */}
      <motion.section
        className="stats-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <motion.div
          className="stats-container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {[
            { number: "10,000+", label: "활성 사용자" },
            { number: "50,000+", label: "작성된 다이어리" },
            { number: "95%", label: "만족도" },
            { number: "24/7", label: "AI 지원" },
          ].map((stat, i) => (
            <motion.div key={i} variants={fadeDelay(i * 0.15)}>
              <StatBox {...stat} />
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* 5. 사용자 후기 */}
      <motion.section
        className="reviews-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <motion.div
          className="reviews-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {[
            { name: "김00", role: "직장인, 27세", comment: "매일 감정을 기록하면서 제 자신을 더 잘 이해하게 되었어요. AI 분석도 정말 정확하고 도움이 돼요!", rating: 5 },
            { name: "이00", role: "대학생, 22세", comment: "혼자 끙끙 앓던 고민들을 챗온에서 나누면서 많은 위로를 받았습니다. 익명이라 더 솔직할 수 있어요.", rating: 5 },
            { name: "정00", role: "프리랜서, 31세", comment: "감정 패턴을 보면서 제가 어떤 상황에서 스트레스를 받는지 알게 됐어요. 이제는 미리 대비할 수 있어요!", rating: 5 },
          ].map((review, i) => (
            <motion.div key={i} variants={fadeDelay(i * 0.2)}>
              <ReviewCard {...review} />
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* 6. CTA 섹션 */}
      <motion.section
        className="cta-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
      >
        <h2 className="cta-title">
          지금 바로 시작하세요
        </h2>
        <p className="cta-description">
          당신의 감정 여행을 토닥톡과 함께하세요
        </p>
        <div className="cta-buttons">
          <button
            onClick={() => navigate('/')}
            className="cta-button-primary"
          >
            시작하기
          </button>
          <button
            onClick={() => navigate('/')}
            className="cta-button-secondary"
          >
            더 알아보기
          </button>
        </div>
        <div 
          className="cta-sublink"
          onClick={() => navigate('/')}
        >
          오늘의 감정 기록하러 가기 ➜
        </div>
      </motion.section>

      {/* 7. 푸터 */}
        <Footer />


    </motion.div>
  );
}

// 서브 컴포넌트들
function FeatureBox({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="feature-box">
      <div className="feature-box-icon">{icon}</div>
      <h3 className="feature-box-title">{title}</h3>
      <p className="feature-box-description">{description}</p>
    </div>
  );
}

function FunctionCard({ icon, title, description, onClick }: { icon: string; title: string; description: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="function-card">
      <div className="function-card-icon">{icon}</div>
      <h3 className="function-card-title">{title}</h3>
      <p className="function-card-description">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description, color }: { number: string; title: string; description: string; color: string }) {
  return (
    <div className="step-card">
      <div className={`step-number ${color}`}>
        {number}
      </div>
      <h3 className="step-title">{title}</h3>
      <p className="step-description">{description}</p>
    </div>
  );
}

function StatBox({ number, label }: { number: string; label: string }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  // 숫자에서 숫자만 추출 (예: "10,000+" → 10000)
  const numericValue = parseInt(number.replace(/[^0-9]/g, ""));

  return (
    <div ref={ref} className="stat-box">
      <div className="stat-box-number">
        {inView ? (
          <CountUp
            end={numericValue}
            duration={2.4}
            separator=","
          />
        ) : (
          0
        )}
        {number.includes("+") && "+"}
        {number.includes("%") && "%"}
      </div>
      <div className="stat-box-label">{label}</div>
    </div>
  );
}

function ReviewCard({ name, role, comment, rating }: { name: string; role: string; comment: string; rating: number }) {
  return (
    <div className="review-card">
      <div className="review-rating">
        {'⭐'.repeat(rating)}
      </div>
      <p className="review-comment">
        "{comment}"
      </p>
      <div>
        <div className="review-author-name">{name}</div>
        <div className="review-author-role">{role}</div>
      </div>
    </div>
  );
}

// 🌙 감정 스토리 섹션 컴포넌트
function EmotionStorySection() {
  return (
    <section className="emotion-story-section">
      <h2 className="emotion-story-title">당신의 하루는 어떤 색인가요?</h2>
      <p className="emotion-story-description">
        토닥톡은 당신의 감정을 '색'으로 기억합니다.<br />
        기쁨은 노랑, 슬픔은 파랑, 설렘은 분홍빛으로 번져요.
      </p>

      <div className="emotion-color-strip">
        <div className="emotion-color" style={{ background: '#FFD166' }}>기쁨</div>
        <div className="emotion-color" style={{ background: '#6EC1E4' }}>슬픔</div>
        <div className="emotion-color" style={{ background: '#FFB7C5' }}>설렘</div>
        <div className="emotion-color" style={{ background: '#A1C181' }}>평온</div>
        <div className="emotion-color" style={{ background: '#CDB4DB' }}>불안</div>
      </div>
    </section>
  );
}

// 푸터 컴포넌트
function Footer() {
  const navigate = useNavigate();
  
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* 상단 영역 */}
        <div className="footer-top">
          {/* 회사 정보 */}
          <div className="footer-section">
            <h3 className="footer-logo">토닥톡</h3>
            <p className="footer-description">
              감정을 기록하고 성장하는 공간<br />
              당신의 마음을 이해하는 AI 감정 다이어리
            </p>
          </div>

          {/* 서비스 링크 */}
          <div className="footer-section">
            <h4 className="footer-title">서비스</h4>
            <ul className="footer-links">
              <li><a onClick={() => navigate('/diary')}>다이어리</a></li>
              <li><a onClick={() => navigate('/history')}>히스토리</a></li>
              <li><a onClick={() => navigate('/goals')}>목표</a></li>
              <li><a onClick={() => navigate('/online')}>챗온</a></li>
            </ul>
          </div>

          {/* 고객지원 링크 */}
          <div className="footer-section">
            <h4 className="footer-title">고객지원</h4>
            <ul className="footer-links">
              <li><a onClick={() => navigate('/support')}>고객센터</a></li>
              <li><a onClick={() => navigate('/support')}>자주 묻는 질문</a></li>
              <li><a onClick={() => navigate('/support')}>이용가이드</a></li>
              <li><a onClick={() => navigate('/support')}>문의하기</a></li>
            </ul>
          </div>

          {/* 회사 링크 */}
          <div className="footer-section">
            <h4 className="footer-title">회사</h4>
            <ul className="footer-links">
              <li><a href="#">회사소개</a></li>
              <li><a href="#">채용정보</a></li>
              <li><a href="#">파트너십</a></li>
              <li><a href="#">공지사항</a></li>
            </ul>
          </div>
        </div>

        {/* 하단 영역 */}
        <div className="footer-bottom">
          <div className="footer-legal">
            <a href="#" className="legal-link">이용약관</a>
            <span className="separator">|</span>
            <a href="#" className="legal-link strong">개인정보처리방침</a>
            <span className="separator">|</span>
            <a href="#" className="legal-link">위치기반서비스 이용약관</a>
          </div>
          
          <p className="footer-copyright">
            © 2025 토닥톡 TodakTalk. All rights reserved.
          </p>
          
          <p className="footer-info">
            사업자등록번호: 123-45-67890 | 대표이사: 김아무개<br />
            주소: 대구광역시 런던구 런던로 123<br />
            고객센터: 1234-5678 | 이메일: contact@todaktalk.com
          </p>
        </div>
      </div>
    </footer>
  );
}
