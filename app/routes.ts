import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  // 클라이언트 페이지
  index('routes/client/home.tsx'),

  // 서버 API
  route('server/products/:barcode', 'routes/server/products.$barcode.tsx'),

  // 추가 서버 라우트 예시
  // route('server/products', 'routes/server/products.tsx'),
  // route('server/categories', 'routes/server/categories.tsx'),
] satisfies RouteConfig;
