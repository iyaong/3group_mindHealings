import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Goals.css';

interface EmotionGoal {
  _id: string;
  category: 'emotion';
  type: string;
  targetValue: number;
  currentValue: number;
  duration: number;
  description: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: string;
  startDate: string;
  endDate: string;
}

interface ScheduleGoal {
  _id: string;
  category: 'schedule';
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  isCompleted: boolean;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

type Goal = EmotionGoal | ScheduleGoal;

const goalTypeLabels: Record<string, string> = {
  positiveRate: '긍정률',
  sessionCount: '대화 횟수',
  averageIntensity: '평균 감정 강도',
  specificEmotion: '특정 감정 기록'
};

const goalTypeIcons: Record<string, string> = {
  positiveRate: '😊',
  sessionCount: '💬',
  averageIntensity: '📊',
  specificEmotion: '🎯'
};

const priorityColors: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444'
};

const priorityLabels: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음'
};

export default function Goals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [goalCategory, setGoalCategory] = useState<'emotion' | 'schedule'>('emotion');

  // 새 감정 목표 생성 폼
  const [newEmotionGoal, setNewEmotionGoal] = useState({
    type: 'positiveRate',
    targetValue: 70,
    duration: 7,
    description: ''
  });

  // 새 스케줄 목표 생성 폼
  const [newScheduleGoal, setNewScheduleGoal] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    tags: [] as string[]
  });

  useEffect(() => {
    fetchGoals();
  }, [activeTab]);

  const fetchGoals = async () => {
    try {
      const response = await fetch(`http://localhost:7780/api/goals?status=${activeTab}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.ok) {
        setGoals(data.goals);
      }
    } catch (error) {
      console.error('목표 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async () => {
    try {
      const body = goalCategory === 'emotion' 
        ? { category: 'emotion', ...newEmotionGoal }
        : { category: 'schedule', ...newScheduleGoal };

      const response = await fetch('http://localhost:7780/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.ok) {
        setShowCreateModal(false);
        setNewEmotionGoal({
          type: 'positiveRate',
          targetValue: 70,
          duration: 7,
          description: ''
        });
        setNewScheduleGoal({
          title: '',
          description: '',
          dueDate: '',
          priority: 'medium',
          tags: []
        });
        fetchGoals();
      }
    } catch (error) {
      console.error('목표 생성 실패:', error);
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!confirm('이 목표를 삭제하시겠습니까?')) return;
    
    try {
      const response = await fetch(`http://localhost:7780/api/goals/${goalId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.ok) {
        fetchGoals();
      }
    } catch (error) {
      console.error('목표 삭제 실패:', error);
    }
  };

  const cancelGoal = async (goalId: string) => {
    if (!confirm('이 목표를 취소하시겠습니까?')) return;
    
    try {
      const response = await fetch(`http://localhost:7780/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'cancelled' })
      });
      const data = await response.json();
      if (data.ok) {
        fetchGoals();
      }
    } catch (error) {
      console.error('목표 취소 실패:', error);
    }
  };

  const toggleScheduleComplete = async (goal: ScheduleGoal) => {
    try {
      const response = await fetch(`http://localhost:7780/api/goals/${goal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isCompleted: !goal.isCompleted })
      });
      const data = await response.json();
      if (data.ok) {
        fetchGoals();
      }
    } catch (error) {
      console.error('목표 완료 토글 실패:', error);
    }
  };

  const getRemainingDays = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return '#4ade80';
    if (progress >= 50) return '#fbbf24';
    return '#60a5fa';
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { text: '진행중', color: '#3b82f6' },
      completed: { text: '달성완료', color: '#10b981' },
      failed: { text: '기간만료', color: '#ef4444' },
      cancelled: { text: '취소됨', color: '#6b7280' }
    };
    const badge = badges[status as keyof typeof badges] || badges.active;
    return (
      <span style={{
        background: badge.color,
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600'
      }}>
        {badge.text}
      </span>
    );
  };

  const renderEmotionGoal = (goal: EmotionGoal) => (
    <div key={goal._id} className="goal-card">
      <div className="goal-card-header">
        <div className="goal-type">
          <span className="goal-icon">{goalTypeIcons[goal.type]}</span>
          <span className="goal-type-label">{goalTypeLabels[goal.type]}</span>
        </div>
        {getStatusBadge(goal.status)}
      </div>

      <div className="goal-description">
        {goal.description || `${goalTypeLabels[goal.type]} ${goal.targetValue}${goal.type === 'positiveRate' ? '%' : '회'} 달성`}
      </div>

      <div className="goal-progress-section">
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill"
            style={{ 
              width: `${goal.progress}%`,
              background: getProgressColor(goal.progress)
            }}
          />
        </div>
        <div className="progress-text">
          {goal.currentValue} / {goal.targetValue}{goal.type === 'positiveRate' ? '%' : '회'} ({goal.progress}%)
        </div>
      </div>

      <div className="goal-meta">
        {goal.status === 'active' && (
          <span className="remaining-days">
            ⏱️ {getRemainingDays(goal.endDate)}일 남음
          </span>
        )}
        {goal.status === 'completed' && (
          <span className="completed-badge">
            🎉 목표 달성!
          </span>
        )}
      </div>

      <div className="goal-actions">
        {goal.status === 'active' && (
          <button 
            className="cancel-button"
            onClick={() => cancelGoal(goal._id)}
          >
            취소
          </button>
        )}
        <button 
          className="delete-button"
          onClick={() => deleteGoal(goal._id)}
        >
          삭제
        </button>
      </div>
    </div>
  );

  const renderScheduleGoal = (goal: ScheduleGoal) => (
    <div key={goal._id} className="goal-card schedule-goal">
      <div className="goal-card-header">
        <div className="goal-type">
          <span className="goal-icon">📅</span>
          <span className="goal-type-label">{goal.title || '일정 목표'}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            background: priorityColors[goal.priority],
            color: 'white',
            padding: '4px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            {priorityLabels[goal.priority]}
          </span>
          {getStatusBadge(goal.status)}
        </div>
      </div>

      <div className="goal-description">
        {goal.description}
      </div>

      {goal.tags.length > 0 && (
        <div className="goal-tags">
          {goal.tags.map((tag, idx) => (
            <span key={idx} className="goal-tag">#{tag}</span>
          ))}
        </div>
      )}

      <div className="goal-meta">
        <span className="due-date">
          📆 마감: {new Date(goal.dueDate).toLocaleDateString('ko-KR')}
        </span>
      </div>

      <div className="goal-actions">
        {goal.status === 'active' && (
          <button 
            className={goal.isCompleted ? 'undo-button' : 'complete-button'}
            onClick={() => toggleScheduleComplete(goal)}
          >
            {goal.isCompleted ? '완료 취소' : '완료'}
          </button>
        )}
        <button 
          className="delete-button"
          onClick={() => deleteGoal(goal._id)}
        >
          삭제
        </button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="goals-loading">목표를 불러오는 중...</div>;
  }

  return (
    <div className="goals-container">
      <div className="goals-header">
        <h2>🎯 나의 목표</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className="create-goal-button"
            onClick={() => setShowCreateModal(true)}
          >
            + 새 목표 만들기
          </button>
          <button
            onClick={() => navigate('/diary')}
            style={{
              padding: '10px 16px',
              border: '2px solid #6b7280',
              borderRadius: 10,
              background: 'white',
              color: '#374151',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.borderColor = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#6b7280';
            }}
          >
            <span>←</span>
            <span>다이어리</span>
          </button>
        </div>
      </div>

      <div className="goals-tabs">
        <button 
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          진행중인 목표
        </button>
        <button 
          className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          완료된 목표
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="no-goals">
          <p>아직 설정한 목표가 없습니다.</p>
          <p>새로운 목표를 만들어보세요!</p>
        </div>
      ) : (
        <div className="goals-grid">
          {goals.map(goal => 
            goal.category === 'emotion' 
              ? renderEmotionGoal(goal as EmotionGoal)
              : renderScheduleGoal(goal as ScheduleGoal)
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>새 목표 만들기</h3>
            
            <div className="form-group">
              <label>목표 유형</label>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button 
                  className={`category-button ${goalCategory === 'emotion' ? 'active' : ''}`}
                  onClick={() => setGoalCategory('emotion')}
                >
                  😊 감정 목표
                </button>
                <button 
                  className={`category-button ${goalCategory === 'schedule' ? 'active' : ''}`}
                  onClick={() => setGoalCategory('schedule')}
                >
                  📅 스케줄 목표
                </button>
              </div>
            </div>

            {goalCategory === 'emotion' ? (
              <>
                <div className="form-group">
                  <label>목표 유형</label>
                  <select 
                    value={newEmotionGoal.type}
                    onChange={e => setNewEmotionGoal({...newEmotionGoal, type: e.target.value})}
                  >
                    <option value="positiveRate">긍정률 높이기</option>
                    <option value="sessionCount">대화 횟수 늘리기</option>
                    <option value="averageIntensity">감정 강도 안정화</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>목표값</label>
                  <input 
                    type="number"
                    value={newEmotionGoal.targetValue}
                    onChange={e => setNewEmotionGoal({...newEmotionGoal, targetValue: Number(e.target.value)})}
                    min="1"
                  />
                  <span className="input-hint">
                    {newEmotionGoal.type === 'positiveRate' ? '(%)' : '(회)'}
                  </span>
                </div>

                <div className="form-group">
                  <label>기간</label>
                  <select 
                    value={newEmotionGoal.duration}
                    onChange={e => setNewEmotionGoal({...newEmotionGoal, duration: Number(e.target.value)})}
                  >
                    <option value="7">7일</option>
                    <option value="14">14일</option>
                    <option value="30">30일</option>
                    <option value="60">60일</option>
                    <option value="90">90일</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>설명 (선택)</label>
                  <textarea 
                    value={newEmotionGoal.description}
                    onChange={e => setNewEmotionGoal({...newEmotionGoal, description: e.target.value})}
                    placeholder="목표에 대한 간단한 설명을 입력하세요"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>제목</label>
                  <input 
                    type="text"
                    value={newScheduleGoal.title}
                    onChange={e => setNewScheduleGoal({...newScheduleGoal, title: e.target.value})}
                    placeholder="목표 제목을 입력하세요"
                  />
                </div>

                <div className="form-group">
                  <label>설명</label>
                  <textarea 
                    value={newScheduleGoal.description}
                    onChange={e => setNewScheduleGoal({...newScheduleGoal, description: e.target.value})}
                    placeholder="목표에 대한 설명을 입력하세요"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>마감일</label>
                  <input 
                    type="date"
                    value={newScheduleGoal.dueDate}
                    onChange={e => setNewScheduleGoal({...newScheduleGoal, dueDate: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>우선순위</label>
                  <select 
                    value={newScheduleGoal.priority}
                    onChange={e => setNewScheduleGoal({...newScheduleGoal, priority: e.target.value as 'low' | 'medium' | 'high'})}
                  >
                    <option value="low">낮음</option>
                    <option value="medium">보통</option>
                    <option value="high">높음</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>태그 (쉼표로 구분)</label>
                  <input 
                    type="text"
                    placeholder="예: 운동, 독서, 공부"
                    onChange={e => setNewScheduleGoal({
                      ...newScheduleGoal, 
                      tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                    })}
                  />
                </div>
              </>
            )}

            <div className="modal-actions">
              <button 
                className="cancel-modal-button"
                onClick={() => setShowCreateModal(false)}
              >
                취소
              </button>
              <button 
                className="create-modal-button"
                onClick={createGoal}
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
