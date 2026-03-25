export const environment = {
  production: true,
  // En producción el SPA es servido POR Kong en http://65.21.132.180:30800/
  // Rutas relativas — Nginx de Kong proxea /api/v1 al BFF
  apiUrl: '/api/v1',
  airflowUrl: '/airflow/api/v1',
  // Kong en el servidor — gestiona OIDC y proxying
  // Login redirige a kongUrl — Kong inicia el flujo OIDC server-side
  kongUrl: 'http://65.21.132.180:30800',
  m1Url: 'http://65.21.132.180:30800/api/v1/m1',
  m1UrlLocal: 'http://localhost:8001',
};
