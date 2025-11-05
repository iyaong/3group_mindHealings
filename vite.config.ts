import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7780',
        changeOrigin: true,
        secure: false,
      },
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
