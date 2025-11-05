// Toast.tsx — 우아한 토스트 알림 컴포넌트 (alert/confirm 대체)
import React, { useEffect, useState, useCallback, useMemo } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number; // ms
    onClose?: () => void;
}

const Toast = React.memo(function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);

    const handleClose = useCallback(() => {
        setExiting(true);
        setTimeout(() => {
            setVisible(false);
            onClose?.();
        }, 300); // 애니메이션 시간과 일치
    }, [onClose]);

    useEffect(() => {
        // 마운트 후 약간의 딜레이를 주고 등장 애니메이션
        const showTimer = setTimeout(() => setVisible(true), 50);

        // duration 후 자동으로 사라짐
        const hideTimer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [duration, handleClose]);

    const colors = useMemo(() => ({
        success: { bg: 'rgba(236, 253, 245, 0.95)', border: '#10b981', text: '#065f46', icon: '✓' },
        error: { bg: 'rgba(254, 242, 242, 0.95)', border: '#ef4444', text: '#991b1b', icon: '✕' },
        warning: { bg: 'rgba(255, 251, 235, 0.95)', border: '#f59e0b', text: '#92400e', icon: '⚠' },
        info: { bg: 'rgba(239, 246, 255, 0.95)', border: '#3b82f6', text: '#1e3a8a', icon: 'ℹ' },
    }), []);

    const style = colors[type];

    return (
        <div
            className="toast-notification"
            style={{
                position: 'fixed',
                top: visible && !exiting ? 24 : -100,
                left: '50%',
                transform: visible && !exiting ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0.9)',
                zIndex: 9999,
                minWidth: 320,
                maxWidth: 'min(90vw, 480px)',
                padding: '14px 20px',
                borderRadius: 16,
                background: style.bg,
                backdropFilter: 'blur(20px)',
                border: `2px solid ${style.border}`,
                color: style.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: visible && !exiting ? 1 : 0,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div
                    className="toast-icon"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: style.border,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                >
                    {style.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{message}</div>
            </div>
            <button
                onClick={handleClose}
                style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `1px solid ${style.border}`,
                    background: 'rgba(255, 255, 255, 0.5)',
                    color: style.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = style.border;
                    e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                    e.currentTarget.style.color = style.text;
                }}
            >
                ×
            </button>
        </div>
    );
});

// Toast Manager Hook
export function useToast() {
    const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

    const showToast = useCallback((props: ToastProps) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { ...props, id }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const ToastContainer = useCallback(() => (
        <>
            {toasts.map((toast, index) => (
                <div key={toast.id} style={{ position: 'absolute', top: index * 80, width: '100%' }}>
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        duration={toast.duration}
                        onClose={() => {
                            toast.onClose?.();
                            removeToast(toast.id);
                        }}
                    />
                </div>
            ))}
        </>
    ), [toasts, removeToast]);

    return { showToast, ToastContainer };
}

export default Toast;
