// PM2 process configuration for Keep Fit.
// Used by ./scripts/deploy.sh and ./scripts/update.sh.
//
// Override env via .env.production or by editing this file directly.

module.exports = {
  apps: [
    {
      name: "keep-fit",
      // Use the local next binary so we don't depend on PATH for "npm"
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0 --port 3000",
      cwd: __dirname,
      instances: 1, // bump to "max" for cluster mode on a multi-core box
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      // Restart with delay if it crashes more than 10 times in 60s
      min_uptime: "60s",
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      // Keep logs in the project dir; rotate via pm2-logrotate (`pm2 install pm2-logrotate`)
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
