// PM2 process configuration for Keep Fit.
// Two processes:
//   1. keep-fit       — Next.js frontend, port 3000
//   2. keep-fit-api   — Go backend, port 8080 (proxied behind /api by nginx)
//
// Used by ./scripts/deploy.sh and ./scripts/update.sh.

const path = require("path");

module.exports = {
  apps: [
    {
      name: "keep-fit",
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0 --port 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      min_uptime: "60s",
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "./logs/pm2-frontend-error.log",
      out_file: "./logs/pm2-frontend-out.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "keep-fit-api",
      script: "./backend/keep-fit-api",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      min_uptime: "60s",
      max_restarts: 10,
      env: {
        PORT: "8080",
        DB_PATH: path.join(__dirname, "data", "keep-fit.db"),
        // IMPORTANT: pin a real JWT secret in production by setting it in this
        // file or in a wrapper script — without it every restart invalidates
        // every active session.  Generate with:
        //    openssl rand -hex 32
        // JWT_SECRET: "0123456789abcdef...",
        COOKIE_SECURE: "true",
        COOKIE_SAMESITE: "lax",
        JWT_TTL_DAYS: "30",
      },
      error_file: "./logs/pm2-api-error.log",
      out_file: "./logs/pm2-api-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
