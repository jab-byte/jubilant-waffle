========================================================
    南京中考招生咨询管理系统 - 阿里云部署包
========================================================

📦 包含内容：
  ✅ .next/              - 优化后的应用代码
  ✅ public/             - 静态资源
  ✅ package.json        - 依赖配置
  ✅ .env.local          - 环境变量（Supabase 已配置）
  ✅ start.sh            - 启动脚本
  ✅ 快速部署指南.md      - 5分钟上手指南
  ✅ 部署到阿里云-步骤指南.md - 详细部署文档

🚀 快速开始（3步）：

  1. 上传到 ECS
     scp -i your-key.pem 南京中考招生系统-阿里云部署包.tar.gz root@your-ecs-ip:/home/

  2. 解压并安装
     ssh root@your-ecs-ip
     tar -xzf /home/*.tar.gz -C /opt/zs-app/
     cd /opt/zs-app
     npm install -g pnpm
     pnpm install --prod

  3. 启动
     ./start.sh
     # 访问 http://your-ecs-ip:3000

🔐 登录信息：
  用户名：admin
  密码：123456

📋 文档：
  - 详细部署：打开 "部署到阿里云-步骤指南.md"
  - 快速指南：打开 "快速部署指南.md"

⚙️ 技术栈：
  - Next.js 16（React 框架）
  - Supabase（云端数据库）
  - Node.js 18+（运行环境）
  - Nginx（反向代理）

💡 功能：
  ✨ 客户信息管理（增删改查）
  ✨ 沟通日志时间线（支持多条记录）
  ✨ 附件上传预览（图片/视频/文件）
  ✨ 数据导出 Excel
  ✨ 数据备份恢复

⚠️ 注意事项：
  - 首次启动需要 pnpm install 安装依赖（3-5分钟）
  - 建议用 PM2 或 systemd 管理进程
  - 建议配置 Nginx 反向代理（用于 HTTPS、多应用）
  - 域名备案完成后更新 DNS 即可切换

🔗 重要链接：
  - Supabase 控制台：https://app.supabase.com
  - 应用数据库 Project：ozdvmsosnycegpctldml
  - Next.js 文档：https://nextjs.org/docs

✅ 部署完毕！

问题排查：查看文档中的"故障排查"章节
========================================================
