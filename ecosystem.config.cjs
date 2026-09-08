// pm2 process manager config — keeps both services running persistently
// (auto-restart on crash) instead of relying on a terminal window staying
// open. Used both for manual `pm2 start ecosystem.config.cjs` and by the
// self-hosted CI/CD workflow (.github/workflows/deploy.yml) to redeploy.
const path = require("path");

module.exports = {
  apps: [
    {
      name: "pilotage-backend",
      cwd: path.join(__dirname, "backend"),
      script: "src/server.js",
      env: { NODE_ENV: "production" },
    },
    {
      name: "pilotage-frontend",
      cwd: path.join(__dirname, "frontend"),
      script: "./node_modules/.bin/vite",
      args: "preview --host 0.0.0.0 --port 5173",
      env: { NODE_ENV: "production" },
    },
  ],
};
