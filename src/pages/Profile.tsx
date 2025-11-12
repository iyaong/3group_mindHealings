import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import fetchWithBackoff from '../utils/api';
import { useModal } from '../hooks/useModal';
import ProfileCard from '../components/ProfileCard';
import { InlineSpinner } from '../components/LoadingSpinner';
import type { UserProfile } from '../types/api';
import './Profile.css';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { showAlert, ModalContainer } = useModal();
  
  const [profile, setProfile] = useState<UserProfile>({
    id: user?.id || '',
    nickname: user?.nickname || 'User',
    title: '',  // 칭호는 localStorage에서 가져옴
    profileImage: user?.profileImage || '',
    todayEmotion: undefined,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // 프로필 로드 (bio, 감정 TOP3, 오늘의 감정 포함)
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadProfile = async () => {
      try {
        // 기본 프로필 정보 로드
        const res = await fetchWithBackoff('/api/me', { credentials: 'include', signal: controller.signal } as any);
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            console.log('👤 사용자 정보:', data.user);
            setBio(data.user.bio || '');
            setProfile(prev => ({
              ...prev,
              id: data.user._id || data.user.id,
              nickname: data.user.nickname || 'User',
              profileImage: data.user.profileImage || '',
              bio: data.user.bio || '',
            }));
          }
        }

        // 전체 감정 분석의 주 감정 색상 로드 (칭호 API에서)
        const titleRes = await fetchWithBackoff('/api/user/emotion-title', { credentials: 'include', signal: controller.signal } as any);
        if (titleRes.ok) {
          const titleData = await titleRes.json();
          if (titleData.emotion && titleData.color) {
            setProfile(prev => ({
              ...prev,
              todayEmotion: {
                emotion: titleData.emotion,
                color: titleData.color,
                score: 0
              },
            }));
          }
        }

        // 감정 TOP3 로드
        const statsRes = await fetchWithBackoff('/api/user/emotion-stats', { credentials: 'include', signal: controller.signal } as any);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.ok && statsData.topEmotions) {
            setProfile(prev => ({
              ...prev,
              topEmotions: statsData.topEmotions.slice(0, 3),
            }));
          }
        }
      } catch (error) {
        if ((error as any)?.name === 'AbortError') {
          console.log('프로필 로드 취소됨');
        } else {
          console.error('프로필 로드 실패:', error);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  // localStorage에서 칭호 가져오기
  useEffect(() => {
    const loadTitleFromCache = () => {
      const cached = localStorage.getItem('emotion_title_cache');
      if (cached) {
        try {
          const { title } = JSON.parse(cached);
          setProfile(prev => ({ ...prev, title: title || '' }));
        } catch (e) {
          console.error('칭호 로드 실패:', e);
        }
      }
    };

    loadTitleFromCache();

    // 칭호가 업데이트될 때마다 감지
    const handleTitleUpdate = () => {
      loadTitleFromCache();
    };

    window.addEventListener('titleUpdated', handleTitleUpdate);
    window.addEventListener('storage', handleTitleUpdate);

    return () => {
      window.removeEventListener('titleUpdated', handleTitleUpdate);
      window.removeEventListener('storage', handleTitleUpdate);
    };
  }, []);

  // 프로필 저장
  const handleSave = async () => {
    if (!user?.id) return;
    
    // 닉네임 8글자 제한
    if (profile.nickname.length > 8) {
      await showAlert('닉네임은 최대 8글자까지 입력 가능합니다.', undefined, '⚠️');
      return;
    }
    
    try {
      setIsSaving(true);
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nickname: profile.nickname,
          bio: bio,
          profileImage: profile.profileImage,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to save profile');
      
      // 저장 성공 후 프로필 다시 로드하여 상태 업데이트
      const meRes = await fetch('/api/me', { credentials: 'include' });
      if (meRes.ok) {
        const data = await meRes.json();
        if (data.user) {
          setProfile(prev => ({
            ...prev,
            nickname: data.user.nickname,
            profileImage: data.user.profileImage || '',
            bio: data.user.bio || '',
          }));
          setBio(data.user.bio || '');
          
          // Navigation의 useAuth도 업데이트되도록 storage 이벤트 발생
          window.dispatchEvent(new Event('profileUpdated'));
        }
      }

      // 전체 감정 분석의 주 감정 색상 다시 로드
      const titleRes = await fetch('/api/user/emotion-title', {
        credentials: 'include'
      });
      if (titleRes.ok) {
        const titleData = await titleRes.json();
        if (titleData.emotion && titleData.color) {
          setProfile(prev => ({
            ...prev,
            todayEmotion: {
              emotion: titleData.emotion,
              color: titleData.color,
              score: 0
            },
          }));
        }
      }

      // 감정 TOP3도 다시 로드
      const statsRes = await fetch('/api/user/emotion-stats', {
        credentials: 'include'
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.ok && statsData.topEmotions) {
          setProfile(prev => ({
            ...prev,
            topEmotions: statsData.topEmotions.slice(0, 3),
          }));
        }
      }
      
      await showAlert('프로필이 저장되었습니다!', undefined, '✓');
    } catch (error) {
      console.error('Save profile error:', error);
      await showAlert('프로필 저장에 실패했습니다.', undefined, '✕');
    } finally {
      setIsSaving(false);
    }
  };

  // 비밀번호 변경
  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      await showAlert('모든 필드를 입력해주세요.', undefined, '⚠️');
      return;
    }

    if (newPassword !== confirmPassword) {
      await showAlert('새 비밀번호가 일치하지 않습니다.', undefined, '✕');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await fetch('/api/profile/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to change password');
      }

      await showAlert('비밀번호가 변경되었습니다!', undefined, '✓');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Change password error:', error);
      await showAlert(error.message || '비밀번호 변경에 실패했습니다.', undefined, '✕');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '30px 20px',
    }}>
      <h1>프로필 관리</h1>
      
      {/* 섹션 1: 프로필 미리보기 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>프로필 미리보기</h2>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ProfileCard profile={{ ...profile, bio }} showOnline={true} />
        </div>
      </div>

      {/* 섹션 2: 프로필 수정 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>프로필 수정</h2>

        {/* 닉네임 변경 */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#555' }}>
            닉네임 ({profile.nickname.length}/8)
          </label>
          <input
            type="text"
            value={profile.nickname}
            onChange={(e) => {
              if (e.target.value.length <= 8) {
                setProfile({ ...profile, nickname: e.target.value });
              }
            }}
            maxLength={8}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 소개란 */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#555' }}>
            소개 (자기만 보기)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="자기소개를 작성해보세요..."
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              minHeight: '100px',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 비밀번호 변경 */}
        <div style={{ marginBottom: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <h3 style={{ marginBottom: '16px', color: '#555', fontSize: '18px' }}>비밀번호 변경</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#555' }}>
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#555' }}>
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#555' }}>
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handlePasswordChange}
            disabled={changingPassword}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: changingPassword ? '#ccc' : '#C1E6F1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: changingPassword ? 'not-allowed' : 'pointer',
            }}
          >
            {changingPassword ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <InlineSpinner size={16} color="#fff" />
                변경 중...
              </span>
            ) : (
              '비밀번호 변경'
            )}
          </button>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '18px',
            backgroundColor: isSaving ? '#ccc' : '#C1E6F1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            marginTop: '20px',
          }}
        >
          {isSaving ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <InlineSpinner size={18} color="#fff" />
              저장 중...
            </span>
          ) : (
            '프로필 저장'
          )}
        </button>
      </div>

      {/* 섹션 3: 도움말 */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      }}>
        <h2 style={{ marginBottom: '16px', color: '#333' }}>📌 도움말</h2>
        <ul style={{ lineHeight: '1.8', color: '#666', paddingLeft: '20px' }}>
          <li><strong>프로필 미리보기:</strong> 다른 사용자에게 보여지는 내 프로필 카드입니다.</li>
          <li><strong>닉네임:</strong> 매칭 및 채팅에서 표시되는 이름입니다.</li>
          <li><strong>칭호:</strong> History 페이지에서 일기 작성 기록에 따라 자동으로 부여됩니다.</li>
          <li><strong>감정:</strong> 오늘 작성한 일기의 감정이 표시됩니다.</li>
          <li><strong>소개:</strong> 자기만 볼 수 있는 비공개 메모입니다.</li>
          <li><strong>비밀번호 변경:</strong> 현재 비밀번호를 입력 후 새 비밀번호를 설정할 수 있습니다.</li>
        </ul>

        {/* 온보딩 다시 보기 버튼 */}
        <button
          onClick={async () => {
            localStorage.removeItem('onboarding_completed');
            await showAlert('페이지를 새로고침하면 온보딩 가이드가 다시 표시됩니다. 🎉', undefined, '🎓');
            window.location.reload();
          }}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            fontSize: '15px',
            backgroundColor: '#C1E6F1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#A8D8E6';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#C1E6F1';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🎓 온보딩 가이드 다시 보기
        </button>
      </div>

      <ModalContainer />
    </div>
  );
};

export default Profile;
