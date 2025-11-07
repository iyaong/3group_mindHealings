import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 네트워크에서 접근 가능하도록 설정
    port: 5173,
    proxy: { 
      '/api': {
        target: 'http://localhost:7780', // localhost로 변경 (같은 기기일 때)
        changeOrigin: true,
        secure: false,
      },
      // Socket.IO는 프록시 사용 안 함 (클라이언트에서 직접 연결)
    },
  },
  build: {
    // 청크 크기 최적화
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
    // 소스맵 비활성화로 빌드 속도 향상 (프로덕션)
    sourcemap: false,
    // 청크 크기 경고 임계값 증가
    chunkSizeWarningLimit: 1000,
  },
  // 최적화 옵션
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'three'],
  },
})
