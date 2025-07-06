import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// NODE_ENV=production npm run build:clean로 빌드 해야함
// 윈도우(Powershell): $env:NODE_ENV="production"; npm run build

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  ssr: {
    // 모든 의존성을 서버 번들에 포함 => Windows Server 환경에서의 호환성 문제 해결
    noExternal: process.env.NODE_ENV === 'production' ? true : ['@ericblade/quagga2'],
  },
});
