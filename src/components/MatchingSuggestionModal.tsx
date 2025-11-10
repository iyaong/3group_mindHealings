// MatchingSuggestionModal.tsx - 감정 진단 완료 후 매칭 시스템 권유 모달
import { useNavigate } from 'react-router-dom';
import { getEmotionColorConfig } from '../utils/emotionColorUtils';
import './MatchingSuggestionModal.css';

interface MatchingSuggestionModalProps {
  emotion: string;
  color: string;
  colorName?: string; // 서버에서 제공하는 색상 이름 (선택적)
  onClose: () => void;
}

export default function MatchingSuggestionModal({ emotion, color, colorName, onClose }: MatchingSuggestionModalProps) {
  const navigate = useNavigate();
  
  // 감정 색상 설정 가져오기
  const colorConfig = getEmotionColorConfig(emotion);
  
  // colorName이 제공되면 서버의 색상 이름 사용, 아니면 기본 색상 이름 사용
  const displayColorName = colorName || colorConfig.colorName;
  // 실제 색상은 서버에서 제공한 color 사용
  const displayColor = color || colorConfig.background;

  const handleGoToMatching = () => {
    onClose();
    navigate('/online');
  };

  const handleStayInDiary = () => {
    onClose();
  };

  // 감정에 따른 메시지 생성
  const getMessage = () => {
    const emotionMessages: { [key: string]: string } = {
      '기쁨': '기쁜 마음을 다른 분들과 나누어 보는 건 어떨까요?',
      '슬픔': '비슷한 감정을 느끼는 분들과 이야기를 나누면 위로가 될 거예요.',
      '불안': '같은 고민을 가진 분들과 소통하면 마음이 편안해질 수 있어요.',
      '화남': '감정을 이해해주는 분들과 이야기하면 도움이 될 거예요.',
      '평온': '평온한 마음을 나누며 다른 분들에게도 좋은 영향을 줄 수 있어요.',
    };

    return emotionMessages[emotion] || '비슷한 감정을 느끼는 분들과 이야기를 나눠보세요.';
  };

  return (
    <div className="matching-suggestion-overlay" onClick={handleStayInDiary}>
      <div className="matching-suggestion-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="matching-modal-header">
          <div 
            className="matching-modal-color-badge" 
            style={{ 
              backgroundColor: displayColor,
              color: colorConfig.text
            }}
          >
            {displayColorName}
          </div>
          <button className="matching-modal-close" onClick={handleStayInDiary}>
            ✕
          </button>
        </div>

        {/* 내용 */}
        <div className="matching-modal-content">
          <h2 className="matching-modal-title">
            감정 진단이 완료되었어요! 🎉
          </h2>
          <p className="matching-modal-emotion">
            현재 감정: <span style={{ color }}>{emotion}</span>
          </p>
          <p className="matching-modal-message">
            {getMessage()}
          </p>
          <div className="matching-modal-feature">
            <div className="matching-feature-item">
              <span className="feature-icon">🎯</span>
              <span className="feature-text">비슷한 감정을 가진 사람과 매칭</span>
            </div>
            <div className="matching-feature-item">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">익명으로 안전하게 대화</span>
            </div>
            <div className="matching-feature-item">
              <span className="feature-icon">💝</span>
              <span className="feature-text">서로에게 위로와 공감 전달</span>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="matching-modal-actions">
          <button 
            className="matching-modal-btn matching-modal-btn-primary"
            style={{ 
              backgroundColor: colorConfig.background,
              borderColor: colorConfig.background,
              color: colorConfig.text
            }}
            onClick={handleGoToMatching}
          >
            매칭 시스템 이용하기
          </button>
          <button 
            className="matching-modal-btn matching-modal-btn-secondary"
            onClick={handleStayInDiary}
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}
