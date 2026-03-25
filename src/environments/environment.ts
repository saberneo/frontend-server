export const environment = {
  production: false,
  // NestJS BFF (dev local)
  apiUrl: 'http://localhost:3000/api/v1',
  airflowUrl: 'http://localhost:8091/api/v1',
  // Kong en el servidor remoto — gestiona OIDC y proxying
  // El login con Okta redirige a kongUrl — Kong inicia el flujo OIDC server-side
  // URIs registradas en Okta: http://65.21.132.180:30800/oidc/callback (callback de Kong)
  kongUrl: 'http://65.21.132.180:30800',
  m1Url: 'http://65.21.132.180:30800/api/v1/m1',
  m1UrlLocal: 'http://localhost:8001',
};
