export { validateAuthConfig, authConfig } from './auth/config.js';
export { authGuard, isAuthenticated, requireAuthForWs } from './auth/middleware.js';
export { authRoutes } from './auth/routes.js';
export { sessionStore } from './auth/sessionStore.js';
export type { AuthMode, AuthUser } from './auth/types.js';
