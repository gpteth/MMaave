module.exports = {
  apps: [{
    name: 'memepro',
    script: '/home/ec2-user/memepro/current/server.js',
    instances: 1,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
