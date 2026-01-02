/**
 * Environment configuration for standalone deployment.
 * All values come from .env file on the server.
 */
export const ENV = {
  // Database connection string (MySQL or PostgreSQL)
  databaseUrl: process.env.DATABASE_URL ?? "",
  
  // JWT secret for session tokens
  cookieSecret: process.env.JWT_SECRET ?? "",
  
  // Application URL for CORS/cookies
  appUrl: process.env.APP_URL ?? "",
  
  // Cookie security (set to true when behind HTTPS)
  cookieSecure: process.env.COOKIE_SECURE === "true",
  
  // Environment mode
  isProduction: process.env.NODE_ENV === "production",
  
  // Server port
  port: parseInt(process.env.PORT ?? "3000"),
  
  // Log level
  logLevel: process.env.LOG_LEVEL ?? "info",
  
  // Bootstrap admin credentials (optional, for first-run setup)
  adminUsername: process.env.ADMIN_USERNAME ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
};
