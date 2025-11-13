import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../hooks/useModal';
import './Subscription.css';

const Subscription: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert, ModalContainer } = useModal();
  const [currentPlan] = useState<'free' | 'premium'>('free');

  const handleUpgrade = async () => {
    await showAlert('구독 기능은 곧 출시될 예정입니다! 🚀', undefined, '💎');
  };

  return (
    <div className="subscription-page">
      <div className="subscription-container">
        {/* 헤더 */}
        <div className="subscription-header">
          <button 
            className="back-button"
            onClick={() => navigate('/profile')}
          >
            ← 돌아가기
          </button>
          <h1>💎 구독 플랜</h1>
          <p>당신에게 맞는 플랜을 선택하세요</p>
        </div>

        {/* 플랜 카드들 */}
        <div className="plans-grid">
          {/* Free 플랜 */}
          <div className={`plan-card ${currentPlan === 'free' ? 'current-plan' : ''}`}>
            {currentPlan === 'free' && (
              <div className="plan-badge current">
                현재 플랜
              </div>
            )}

            <div className="plan-header">
              <h2>Free</h2>
              <div className="plan-price">
                <span className="price">₩0</span>
                <span className="period">/월</span>
              </div>
              <p className="plan-description">
                기본 감정 분석 및 일기 작성 기능을 무료로 이용하세요.
              </p>
            </div>

            <ul className="plan-features">
              <li>
                <span className="check">✓</span>
                <span>일일 감정 분석</span>
              </li>
              <li>
                <span className="check">✓</span>
                <span>기본 다이어리 작성</span>
              </li>
              <li>
                <span className="check">✓</span>
                <span>감정 히스토리 조회</span>
              </li>
              <li>
                <span className="check">✓</span>
                <span>온라인 매칭 (제한적)</span>
              </li>
              <li>
                <span className="check">✓</span>
                <span>기본 감정 오브</span>
              </li>
            </ul>

            <button 
              className="plan-button current"
              disabled
            >
              현재 사용 중
            </button>
          </div>

          {/* Premium 플랜 */}
          <div className={`plan-card premium ${currentPlan === 'premium' ? 'current-plan' : ''}`}>
            <div className="plan-badge popular">
              ⭐ 인기
            </div>

            <div className="plan-header">
              <h2>Premium</h2>
              <div className="plan-price">
                <span className="price premium-price">₩9,900</span>
                <span className="period">/월</span>
              </div>
              <p className="plan-description">
                모든 프리미엄 기능을 무제한으로 이용하세요.
              </p>
            </div>

            <ul className="plan-features">
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span><strong>Free 플랜의 모든 기능</strong></span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>고급 감정 분석 및 인사이트</span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>AI 감정 예측 및 추천</span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>무제한 온라인 매칭</span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>프리미엄 감정 오브 테마</span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>감정 데이터 심층 분석</span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>데이터 내보내기 (PDF, CSV)</span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>우선 고객 지원</span>
              </li>
              <li className="premium-feature">
                <span className="check premium">✓</span>
                <span>광고 제거</span>
              </li>
            </ul>

            <button 
              className="plan-button premium-button"
              onClick={handleUpgrade}
            >
              Premium 업그레이드
            </button>
          </div>
        </div>

        {/* 비교 표 */}
        <div className="comparison-section">
          <h2>기능 비교</h2>
          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>기능</th>
                  <th>Free</th>
                  <th>Premium</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>일일 감정 분석</td>
                  <td><span className="check-table">✓</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>다이어리 작성</td>
                  <td><span className="check-table">✓</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>감정 히스토리</td>
                  <td><span className="check-table">✓</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>온라인 매칭</td>
                  <td>제한적</td>
                  <td><strong>무제한</strong></td>
                </tr>
                <tr>
                  <td>AI 감정 예측</td>
                  <td><span className="cross">✕</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>고급 인사이트</td>
                  <td><span className="cross">✕</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>프리미엄 테마</td>
                  <td><span className="cross">✕</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>데이터 내보내기</td>
                  <td><span className="cross">✕</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>우선 고객 지원</td>
                  <td><span className="cross">✕</span></td>
                  <td><span className="check-table premium">✓</span></td>
                </tr>
                <tr>
                  <td>광고</td>
                  <td>표시됨</td>
                  <td><strong>제거됨</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="faq-section">
          <h2>자주 묻는 질문</h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>언제든지 취소할 수 있나요?</summary>
              <p>네, 언제든지 구독을 취소할 수 있습니다. 취소 후에도 결제 기간 종료일까지는 Premium 기능을 이용하실 수 있습니다.</p>
            </details>
            <details className="faq-item">
              <summary>환불이 가능한가요?</summary>
              <p>구독 시작 후 14일 이내에는 전액 환불이 가능합니다. 이후에는 다음 결제 주기부터 구독이 취소됩니다.</p>
            </details>
            <details className="faq-item">
              <summary>결제 방법은 무엇이 있나요?</summary>
              <p>신용카드, 체크카드, 간편결제(카카오페이, 네이버페이) 등 다양한 결제 수단을 지원합니다.</p>
            </details>
            <details className="faq-item">
              <summary>Premium 구독 후 데이터는 어떻게 되나요?</summary>
              <p>기존에 작성하신 모든 데이터는 그대로 유지되며, Premium 기능이 추가로 제공됩니다.</p>
            </details>
          </div>
        </div>

        {/* 하단 안내 */}
        <div className="subscription-footer">
          <p>💳 모든 결제는 안전하게 암호화됩니다</p>
          <p>언제든지 취소 가능 • 환불 보장 14일</p>
        </div>
      </div>

      <ModalContainer />
    </div>
  );
};

export default Subscription;

