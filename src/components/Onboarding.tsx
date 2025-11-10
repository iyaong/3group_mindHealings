// Onboarding.tsx - 신규 사용자를 위한 온보딩 투어

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: '토닥톡에 오신 것을 환영합니다! 🎉',
    description: '당신의 감정을 이해하고 함께 성장하는 AI 감정 다이어리입니다.',
    emoji: '💙',
    features: [
      'AI와의 대화로 감정 분석',
      '매일의 감정을 색깔로 기록',
      '다른 사람들과 익명 감정 공유',
      '나의 감정 패턴 분석 & 성장'
    ]
  },
  {
    id: 2,
    title: 'AI 대화로 시작하세요',
    description: 'AI가 당신의 이야기를 들어주고 감정을 분석해드립니다.',
    emoji: '🤖',
    features: [
      '24시간 언제든 대화 가능',
      '자동 감정 분석 & 색상 추천',
      '다정하고 공감적인 대화',
      '대화 내역 자동 저장'
    ],
    action: {
      text: 'AI와 대화 시작하기',
      path: '/chat'
    }
  },
  {
    id: 3,
    title: '감정을 기록하고 분석하세요',
    description: '매일의 감정을 다이어리에 기록하고 나만의 패턴을 발견하세요.',
    emoji: '📔',
    features: [
      '날짜별 감정 다이어리',
      '감정에 어울리는 색상 자동 분석',
      '연속 기록 스트릭 달성',
      '감정 히스토리 차트로 시각화'
    ],
    action: {
      text: '다이어리 보러가기',
      path: '/diary'
    }
  },
  {
    id: 4,
    title: '함께 성장하세요',
    description: '다른 사람들과 감정을 나누고 나의 성장을 확인하세요.',
    emoji: '🌱',
    features: [
      '챗온: 익명 1:1 채팅으로 위로 주고받기',
      '감정 히스토리: 나의 감정 변화 그래프',
      '감정 칭호: AI가 부여하는 나만의 칭호',
      '감정 추천: 맞춤형 활동 제안'
    ],
    action: {
      text: '시작하기',
      path: '/chat'
    }
  }
];

export default function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      if (step.action) {
        navigate(step.action.path);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container">
        {/* 상단: 스킵 버튼 */}
        <button 
          className="onboarding-skip"
          onClick={handleSkip}
          aria-label="온보딩 건너뛰기"
        >
          건너뛰기
        </button>

        {/* 진행 표시 */}
        <div className="onboarding-progress">
          {ONBOARDING_STEPS.map((_, index) => (
            <div
              key={index}
              className={`progress-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            />
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="onboarding-content">
          <div className="onboarding-emoji">{step.emoji}</div>
          <h2 className="onboarding-title">{step.title}</h2>
          <p className="onboarding-description">{step.description}</p>

          <ul className="onboarding-features">
            {step.features.map((feature, index) => (
              <li key={index} className="feature-item">
                <span className="feature-icon">✓</span>
                <span className="feature-text">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 하단: 버튼들 */}
        <div className="onboarding-actions">
          {currentStep > 0 && (
            <button 
              className="onboarding-btn btn-secondary"
              onClick={handlePrev}
            >
              이전
            </button>
          )}
          
          <button 
            className="onboarding-btn btn-primary"
            onClick={handleNext}
          >
            {isLastStep ? (step.action?.text || '시작하기') : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
