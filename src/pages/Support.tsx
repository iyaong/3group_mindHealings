// Support.tsx
// 고객센터 페이지

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Support() {
  const [activeTab, setActiveTab] = useState<'inquiry' | 'history'>('inquiry');

  return (
    <div style={{ 
      maxWidth: 1200, 
      margin: '0 auto', 
      padding: '40px 20px',
      minHeight: 'calc(100vh - 120px)'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: 60
      }}>
        <h1 style={{ 
          fontSize: 42,
          fontWeight: 700,
          marginBottom: 16,
          color: '#1f2937'
        }}>
          고객센터
        </h1>
        <p style={{ 
          fontSize: 18,
          color: '#6b7280',
          lineHeight: 1.6
        }}>
          토닥톡 서비스에 대한 도움이 필요하신가요?<br />
          자주 묻는 질문과 문의 방법을 확인하세요.
        </p>
      </div>

      {/* FAQ 섹션 */}
      <section style={{ marginBottom: 60 }}>
        <h2 style={{ 
          fontSize: 28,
          fontWeight: 600,
          marginBottom: 24,
          color: '#111827'
        }}>
          자주 묻는 질문 (FAQ)
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FAQItem 
            question="토닥톡은 어떤 서비스인가요?"
            answer="토닥톡은 AI 기반의 감정 분석 다이어리 서비스입니다. 매일의 감정을 기록하면 AI가 자동으로 감정을 분석하여 긍정률, 부정률, 감정 강도 등의 인사이트를 제공합니다. 또한 감정 패턴을 파악하여 맞춤형 조언과 추천을 제공하며, 다른 사용자들과 익명으로 소통할 수 있는 커뮤니티 기능도 제공합니다."
          />
          <FAQItem 
            question="다이어리는 어떻게 작성하나요?"
            answer="로그인 후 '다이어리' 메뉴를 클릭하면 오늘의 감정을 기록할 수 있습니다. 제목과 내용을 자유롭게 작성하시면 AI가 자동으로 감정을 분석합니다. 기본 감정(행복, 슬픔, 분노, 놀람, 두려움, 혐오)과 세부 감정(설렘, 감동, 뿌듯함 등)을 모두 인식하며, 작성한 다이어리는 히스토리에서 언제든 다시 확인할 수 있습니다."
          />
          <FAQItem 
            question="챗온 기능은 무엇인가요?"
            answer="챗온은 다른 사용자들과 익명으로 감정을 공유하고 소통할 수 있는 온라인 커뮤니티 공간입니다. 실시간 채팅으로 고민을 나누거나 공감을 받을 수 있으며, AI가 비슷한 감정을 가진 사용자를 매칭해주는 '매칭 추천' 기능도 제공합니다. 모든 대화는 익명으로 이루어지며, 부적절한 언어는 자동으로 필터링됩니다."
          />
          <FAQItem 
            question="히스토리에서는 무엇을 볼 수 있나요?"
            answer="히스토리에서는 그동안 기록한 감정 다이어리를 다양한 방식으로 확인할 수 있습니다. 달력 뷰에서는 날짜별 감정 색상을 한눈에 볼 수 있고, 차트에서는 시간에 따른 감정 변화 추이를 그래프로 확인할 수 있습니다. 또한 AI가 분석한 감정 패턴, 자주 느끼는 감정 Top 5, 감정 예측, 맞춤형 추천 등의 인사이트도 제공받을 수 있습니다."
          />
          <FAQItem 
            question="목표 설정은 어떻게 하나요?"
            answer="'목표' 메뉴에서 개인적인 감정 관리 목표를 설정할 수 있습니다. 감정 목표(긍정률 70% 달성, 주 5회 대화 등)와 일정 목표(할 일 관리)를 생성할 수 있으며, 각 목표의 진행 상황을 실시간으로 추적할 수 있습니다. 목표를 완료하면 성취감을 느낄 수 있고, 미완료 목표는 취소하거나 다시 도전할 수 있습니다."
          />
          <FAQItem 
            question="내 개인정보와 다이어리는 안전한가요?"
            answer="네, 매우 안전합니다. 모든 다이어리 내용은 암호화되어 저장되며, 본인만 열람할 수 있습니다. 비밀번호는 단방향 해시로 암호화되어 저장되므로 관리자도 확인할 수 없습니다. 또한 챗온에서의 대화는 익명으로 이루어지며, 개인 식별 정보는 절대 노출되지 않습니다. 서비스는 HTTPS를 통해 안전하게 통신하며, 정기적인 보안 점검을 실시하고 있습니다."
          />
          <FAQItem 
            question="AI 감정 분석은 얼마나 정확한가요?"
            answer="토닥톡의 AI는 자연어 처리(NLP) 기술을 기반으로 텍스트에서 감정을 분석합니다. 기본 감정 6가지(행복, 슬픔, 분노, 놀람, 두려움, 혐오)와 35가지 이상의 세부 감정을 인식할 수 있으며, 평균 85% 이상의 정확도를 보입니다. 사용자가 더 많이 기록할수록 개인화된 감정 패턴을 학습하여 더 정확한 분석과 추천을 제공합니다."
          />
          <FAQItem 
            question="무료로 모든 기능을 사용할 수 있나요?"
            answer="네, 토닥톡의 모든 핵심 기능은 무료로 제공됩니다. 다이어리 작성, AI 감정 분석, 히스토리 조회, 챗온 커뮤니티, 목표 설정 등 모든 기능을 무료로 무제한 사용하실 수 있습니다. 향후 프리미엄 기능이 추가될 수 있으나, 기본 기능은 계속 무료로 제공될 예정입니다."
          />
          <FAQItem 
            question="다이어리를 삭제하거나 수정할 수 있나요?"
            answer="네, 가능합니다. 히스토리 또는 다이어리 상세 페이지에서 작성한 다이어리를 수정하거나 삭제할 수 있습니다. 삭제된 다이어리는 복구할 수 없으므로 신중하게 결정해주세요. 수정 시에는 AI가 새로운 내용을 다시 분석하여 감정 데이터를 업데이트합니다."
          />
          <FAQItem 
            question="모바일에서도 사용할 수 있나요?"
            answer="네, 토닥톡은 반응형 웹으로 제작되어 PC, 태블릿, 스마트폰 등 모든 기기에서 최적화된 화면으로 사용하실 수 있습니다. 모바일 브라우저(Safari, Chrome 등)에서 접속하시면 됩니다. 향후 모바일 앱도 출시할 예정입니다."
          />
          <FAQItem 
            question="회원 탈퇴는 어떻게 하나요?"
            answer="회원 탈퇴를 원하시는 경우, 고객센터를 통해 문의해주시면 안내해드리겠습니다. 탈퇴 시 작성하신 모든 다이어리, 목표, 채팅 기록 등이 삭제되며, 삭제된 데이터는 복구할 수 없습니다. 탈퇴 전 중요한 다이어리는 백업해두시기를 권장합니다."
          />
          <FAQItem 
            question="비밀번호를 잊어버렸어요. 어떻게 하나요?"
            answer="비밀번호를 잊어버린 경우, 로그인 페이지에서 '비밀번호 찾기' 기능을 이용하실 수 있습니다. 가입 시 등록한 이메일로 비밀번호 재설정 링크가 발송됩니다. 이메일을 받지 못한 경우 스팸 메일함을 확인하시거나, 고객센터로 문의해주세요."
          />
        </div>
      </section>

      {/* 탭 메뉴와 문의 섹션 */}
      <section style={{ marginBottom: 60 }}>
        {/* 탭 메뉴 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 32,
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: 0
        }}>
          <button
            onClick={() => setActiveTab('inquiry')}
            style={{
              padding: '12px 32px',
              fontSize: 18,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'inquiry' ? '3px solid #C1E6F1' : '3px solid transparent',
              color: activeTab === 'inquiry' ? '#C1E6F1' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.3s',
              marginBottom: -2
            }}
          >
            1:1 문의하기
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 32px',
              fontSize: 18,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #C1E6F1' : '3px solid transparent',
              color: activeTab === 'history' ? '#C1E6F1' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.3s',
              marginBottom: -2
            }}
          >
            내 문의 내역
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'inquiry' ? <InquiryForm /> : <InquiryHistory />}
      </section>

      {/* 문의하기 섹션 */}
      <section style={{
        background: 'linear-gradient(135deg, #C1E6F1 0%, #D5BCFF 100%)',
        padding: 48,
        borderRadius: 16,
        color: 'white',
        textAlign: 'center'
      }}>
        <h2 style={{ 
          fontSize: 28,
          fontWeight: 600,
          marginBottom: 16
        }}>
          문의하기
        </h2>
        <p style={{ 
          fontSize: 16,
          marginBottom: 32,
          opacity: 0.9
        }}>
          더 궁금하신 사항이 있으신가요?<br />
          언제든지 문의해 주세요.
        </p>
        
        <div style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <ContactCard 
            icon="📧"
            title="이메일 문의"
            content="support@todaktalk.com"
          />
          <ContactCard 
            icon="💬"
            title="카카오톡 문의"
            content="@토닥톡"
          />
          <ContactCard 
            icon="📞"
            title="전화 문의"
            content="1234-5678"
          />
        </div>
      </section>

      {/* 운영시간 안내 */}
      <div style={{
        marginTop: 40,
        padding: 24,
        background: '#f9fafb',
        borderRadius: 12,
        textAlign: 'center'
      }}>
        <p style={{ 
          fontSize: 14,
          color: '#6b7280',
          lineHeight: 1.8
        }}>
          <strong>운영시간:</strong> 평일 09:00 - 18:00 (주말 및 공휴일 제외)<br />
          <strong>평균 응답 시간:</strong> 24시간 이내
        </p>
      </div>
    </div>
  );
}

// FAQ 아이템 컴포넌트
function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: '20px 24px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}>
      <summary style={{
        fontSize: 18,
        fontWeight: 600,
        color: '#111827',
        listStyle: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {question}
        <span style={{ fontSize: 24, color: '#9ca3af' }}>+</span>
      </summary>
      <p style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid #f3f4f6',
        fontSize: 16,
        color: '#6b7280',
        lineHeight: 1.6
      }}>
        {answer}
      </p>
    </details>
  );
}

// 연락처 카드 컴포넌트
function ContactCard({ icon, title, content }: { icon: string; title: string; content: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(10px)',
      padding: 24,
      borderRadius: 12,
      minWidth: 200,
      transition: 'transform 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, opacity: 0.9 }}>{content}</p>
    </div>
  );
}

// 1:1 문의 폼 컴포넌트
function InquiryForm() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.nickname || '',
    email: user?.email || '',
    category: '일반문의',
    title: '',
    content: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // 사용자 정보가 로드되면 폼 데이터 업데이트
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.nickname || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/support/inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitMessage('문의가 성공적으로 접수되었습니다. 빠른 시일 내에 답변 드리겠습니다.');
        setFormData({
          name: user?.nickname || '',
          email: user?.email || '',
          category: '일반문의',
          title: '',
          content: ''
        });
      } else {
        setSubmitMessage(data.message || '문의 접수 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } catch (error) {
      console.error('문의 접수 오류:', error);
      setSubmitMessage('문의 접수 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: 16,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#374151'
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 40,
      maxWidth: 800,
      margin: '0 auto'
    }}>
      <div style={{ display: 'grid', gap: 24 }}>
        {/* 이름 */}
        <div>
          <label style={labelStyle}>
            이름 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="이름을 입력하세요"
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>

        {/* 이메일 */}
        <div>
          <label style={labelStyle}>
            이메일 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="답변 받으실 이메일을 입력하세요"
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>

        {/* 문의 유형 */}
        <div>
          <label style={labelStyle}>
            문의 유형 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            style={{
              ...inputStyle,
              cursor: 'pointer',
              backgroundColor: 'white'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          >
            <option value="일반문의">일반문의</option>
            <option value="서비스이용">서비스 이용</option>
            <option value="기술지원">기술 지원</option>
            <option value="계정문의">계정 문의</option>
            <option value="제안/피드백">제안/피드백</option>
            <option value="기타">기타</option>
          </select>
        </div>

        {/* 제목 */}
        <div>
          <label style={labelStyle}>
            제목 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="문의 제목을 입력하세요"
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>

        {/* 문의 내용 */}
        <div>
          <label style={labelStyle}>
            문의 내용 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            placeholder="문의하실 내용을 자세히 작성해 주세요"
            rows={8}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 600,
            color: 'white',
            background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #C1E6F1 0%, #D5BCFF 100%)',
            border: 'none',
            borderRadius: 8,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'transform 0.2s, opacity 0.2s',
            opacity: isSubmitting ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isSubmitting ? '전송 중...' : '문의하기'}
        </button>

        {/* 제출 메시지 */}
        {submitMessage && (
          <div style={{
            padding: 16,
            borderRadius: 8,
            background: submitMessage.includes('성공') ? '#d1fae5' : '#fee2e2',
            color: submitMessage.includes('성공') ? '#065f46' : '#991b1b',
            fontSize: 14,
            textAlign: 'center'
          }}>
            {submitMessage}
          </div>
        )}
      </div>

      {/* 안내 문구 */}
      <p style={{
        marginTop: 24,
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 1.6
      }}>
        문의하신 내용은 평일 기준 24시간 이내에 답변 드립니다.<br />
        개인정보는 문의 답변 목적으로만 사용되며, 답변 완료 후 안전하게 처리됩니다.
      </p>
    </form>
  );
}

// 문의 내역 타입 정의
interface Inquiry {
  id: number;
  category: string;
  title: string;
  content: string;
  status: 'waiting' | 'answered';
  date: string;
  answer: string | null;
}

// 문의 내역 컴포넌트
function InquiryHistory() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // 문의 내역 가져오기
  useEffect(() => {
    const fetchInquiries = async () => {
      try {
        const response = await fetch('/api/support/inquiries', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setInquiries(data.inquiries);
        } else {
          console.error('문의 내역 조회 실패');
        }
      } catch (error) {
        console.error('문의 내역 조회 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInquiries();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return { bg: '#fef3c7', color: '#92400e', text: '답변대기' };
      case 'answered': return { bg: '#d1fae5', color: '#065f46', text: '답변완료' };
      default: return { bg: '#e5e7eb', color: '#374151', text: '확인중' };
    }
  };

  if (loading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '80px 20px',
        background: '#f9fafb',
        borderRadius: 16
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h3 style={{ fontSize: 20, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          문의 내역을 불러오는 중...
        </h3>
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '80px 20px',
        background: '#f9fafb',
        borderRadius: 16
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <h3 style={{ fontSize: 20, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          문의 내역이 없습니다
        </h3>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          궁금한 사항이 있으시면 1:1 문의하기를 이용해주세요.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {inquiries.map((inquiry) => {
          const statusInfo = getStatusColor(inquiry.status);
          const isExpanded = selectedInquiry === Number(inquiry.id);

          return (
            <div
              key={inquiry.id}
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'all 0.3s'
              }}
            >
              {/* 문의 헤더 */}
              <div
                onClick={() => setSelectedInquiry(isExpanded ? null : Number(inquiry.id))}
                style={{
                  padding: '20px 24px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: statusInfo.bg,
                      color: statusInfo.color
                    }}>
                      {statusInfo.text}
                    </span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      background: '#f3f4f6',
                      color: '#6b7280'
                    }}>
                      {inquiry.category}
                    </span>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>
                      {inquiry.date}
                    </span>
                  </div>
                  <h3 style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: 8
                  }}>
                    {inquiry.title}
                  </h3>
                  {!isExpanded && (
                    <p style={{
                      fontSize: 14,
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {inquiry.content}
                    </p>
                  )}
                </div>
                <button style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  color: '#9ca3af',
                  cursor: 'pointer',
                  transition: 'transform 0.3s',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                  ▼
                </button>
              </div>

              {/* 문의 상세 내용 */}
              {isExpanded && (
                <div style={{
                  padding: '0 24px 24px 24px',
                  borderTop: '1px solid #f3f4f6'
                }}>
                  {/* 문의 내용 */}
                  <div style={{ marginTop: 20, marginBottom: 20 }}>
                    <h4 style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: 8
                    }}>
                      문의 내용
                    </h4>
                    <p style={{
                      fontSize: 15,
                      color: '#111827',
                      lineHeight: 1.7,
                      background: '#f9fafb',
                      padding: 16,
                      borderRadius: 8
                    }}>
                      {inquiry.content}
                    </p>
                  </div>

                  {/* 답변 내용 */}
                  {inquiry.answer ? (
                    <div>
                      <h4 style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: 8
                      }}>
                        답변
                      </h4>
                      <div style={{
                        background: '#ede9fe',
                        padding: 16,
                        borderRadius: 8,
                        borderLeft: '4px solid #8b5cf6'
                      }}>
                        <p style={{
                          fontSize: 15,
                          color: '#111827',
                          lineHeight: 1.7
                        }}>
                          {inquiry.answer}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: '#fef3c7',
                      padding: 16,
                      borderRadius: 8,
                      textAlign: 'center'
                    }}>
                      <p style={{ fontSize: 14, color: '#92400e' }}>
                        답변을 준비 중입니다. 조금만 기다려 주세요. 📝
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 안내 문구 */}
      <div style={{
        marginTop: 32,
        padding: 20,
        background: '#f9fafb',
        borderRadius: 12,
        textAlign: 'center'
      }}>
        <p style={{
          fontSize: 14,
          color: '#6b7280',
          lineHeight: 1.6
        }}>
          💡 문의 내역은 최근 3개월까지 보관됩니다.<br />
          답변이 완료된 문의는 이메일로도 발송됩니다.
        </p>
      </div>
    </div>
  );
}
