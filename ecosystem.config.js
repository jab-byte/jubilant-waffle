// PM2 进程管理配置文件
// 用于在阿里云 ECS 上直接运行 Node.js 应用

module.exports = {
  apps: [
    {
      name: 'customer-management',
      script: '.next/standalone/server.js',
      cwd: '/var/www/app', // 根据实际部署路径修改
      instances: 'max', // 使用所有 CPU 核心
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      env_file: '.env.production', // 环境变量文件
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
