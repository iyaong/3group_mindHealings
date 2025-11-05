// DiaryCalendar.tsx — 일기 달력 컴포넌트
import { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './DiaryCalendar.css';
import type { DiarySessionResponse } from '../types/api';

interface DiaryCalendarProps {
  sessions: DiarySessionResponse[];
  onDateSelect: (date: string | null) => void;
  selectedDate?: string | null;
  activeTab: 'ai' | 'online';
}

export default function DiaryCalendar({ sessions, onDateSelect, selectedDate, activeTab }: DiaryCalendarProps) {
  const [isExpanded, setIsExpanded] = useState(false); // 달력 접기/펼치기 상태
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // 일기가 있는 날짜 추출
  const datesWithEntries = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach((session) => {
      dates.add(session.date);
    });
    return dates;
  }, [sessions]);

  // 달력 타일에 표시할 포인트
  const tileClassName = ({ date }: { date: Date }) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const hasEntries = datesWithEntries.has(dateStr);
    const isSelected = selectedDate === dateStr;
    
    if (isSelected && hasEntries) return 'calendar-tile-has-entries-selected';
    if (isSelected) return 'calendar-tile-selected';
    if (hasEntries) return 'calendar-tile-has-entries';
    return '';
  };

  // 날짜 클릭 핸들러
  const handleDateChange = (value: unknown) => {
    if (!value) {
      onDateSelect(null);
      return;
    }
    
    // value가 Date인 경우만 처리
    if (value instanceof Date) {
      const dateStr = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
      onDateSelect(dateStr);
    }
  };

  // 오늘 버튼 클릭
  const handleTodayClick = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setCalendarDate(today);
    onDateSelect(todayStr);
  };

  // 필터 해제
  const handleClearFilter = () => {
    onDateSelect(null);
  };

  return (
    <div className="diary-calendar-container">
      {/* 달력 헤더 (접기/펼치기 토글) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          marginBottom: isExpanded ? 16 : 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
          {activeTab === 'ai' ? '📅 AI 대화 달력' : '📅 온라인 채팅 달력'}
        </h3>
        <span style={{ 
          fontSize: 16, 
          color: '#fff', 
          transition: 'transform 0.3s ease',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>
          ▼
        </span>
      </button>

      {/* 달력 내용 (접기/펼치기) */}
      {isExpanded && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleTodayClick}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid #6366f1',
                  background: '#eef2ff',
                  color: '#4338ca',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                오늘
              </button>
              {selectedDate && (
                <button
                  onClick={handleClearFilter}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    borderRadius: 6,
                    border: '1px solid #9ca3af',
                    background: '#f9fafb',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  전체
                </button>
              )}
            </div>
          </div>
          
          <Calendar
            onChange={handleDateChange}
            value={selectedDate ? new Date(selectedDate + 'T00:00:00') : calendarDate}
            tileClassName={tileClassName}
            locale="ko-KR"
            calendarType="gregory"
            formatDay={(_locale, date) => String(date.getDate())}
            next2Label={null}
            prev2Label={null}
            minDetail="month"
            maxDetail="month"
          />
          
          {selectedDate && (
            <div style={{ 
              marginTop: 12, 
              padding: 10, 
              background: '#eef2ff', 
              borderRadius: 8, 
              fontSize: 12, 
              color: '#4338ca',
              textAlign: 'center',
              fontWeight: 600
            }}>
              📌 {selectedDate} 선택됨
            </div>
          )}
        </>
      )}
    </div>
  );
}

