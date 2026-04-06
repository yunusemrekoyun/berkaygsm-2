module.exports = {
  apps: [
    {
      name: "ceplife-web",
      script: "server.js",
      cwd: "/srv/ceplife/current",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
      kill_timeout: 15000,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: process.env.PORT || "3000",
        HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
      },
    },
  ],
};
