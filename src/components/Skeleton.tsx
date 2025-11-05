// Skeleton.tsx — 로딩 상태를 위한 스켈레톤 UI 컴포넌트
import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    style?: React.CSSProperties;
}

export const Skeleton = React.memo(function Skeleton({ width = '100%', height = 20, borderRadius = 8, style = {} }: SkeletonProps) {
    return (
        <div
            className="skeleton"
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
                ...style,
            }}
        />
    );
});

// 채팅 메시지 스켈레톤
export const ChatMessageSkeleton = React.memo(function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                marginBottom: 8,
                gap: 8,
            }}
        >
            {!isUser && <Skeleton width={28} height={28} borderRadius="50%" />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '70%' }}>
                <Skeleton width={isUser ? 200 : 240} height={40} borderRadius={16} />
            </div>
            {isUser && <Skeleton width={28} height={28} borderRadius="50%" />}
        </div>
    );
});

// 다이어리 목록 아이템 스켈레톤
export const DiaryListItemSkeleton = React.memo(function DiaryListItemSkeleton() {
    return (
        <div
            style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#fff',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Skeleton width={16} height={16} borderRadius="50%" />
                <Skeleton width={120} height={16} />
            </div>
            <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
        </div>
    );
});

// 여러 개의 채팅 메시지 스켈레톤
export const ChatLoadingSkeleton = React.memo(function ChatLoadingSkeleton() {
    return (
        <div style={{ padding: 12 }}>
            <ChatMessageSkeleton isUser={false} />
            <ChatMessageSkeleton isUser={true} />
            <ChatMessageSkeleton isUser={false} />
            <ChatMessageSkeleton isUser={true} />
        </div>
    );
});

// 다이어리 목록 스켈레톤
export const DiaryListSkeleton = React.memo(function DiaryListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: count }).map((_, i) => (
                <DiaryListItemSkeleton key={i} />
            ))}
        </div>
    );
});

// 감정 오브 스켈레톤
export const EmotionOrbSkeleton = React.memo(function EmotionOrbSkeleton({ size = 200 }: { size?: number }) {
    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 200%',
            animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        }} />
    );
});

