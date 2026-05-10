#!/bin/bash

# 南京中考招生系统 - 一键部署脚本
# 适用于新华云/阿里云 ECS (CentOS/Ubuntu)

set -e

echo "========================================"
echo "  南京中考招生系统 - 一键部署"
echo "========================================"
echo ""

# 检测操作系统
if [ -f /etc/redhat-release ]; then
    OS="centos"
    PKG_MANAGER="yum"
elif [ -f /etc/lsb-release ] || [ -f /etc/debian_version ]; then
    OS="ubuntu"
    PKG_MANAGER="apt-get"
else
    echo "不支持的操作系统，请手动部署"
    exit 1
fi

echo "[1/6] 检测到操作系统: $OS"

# 安装 Node.js
echo ""
echo "[2/6] 安装 Node.js..."
if ! command -v node &> /dev/null; then
    if [ "$OS" = "centos" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo $PKG_MANAGER install -y nodejs
    fi
    echo "Node.js 安装完成: $(node -v)"
else
    echo "Node.js 已安装: $(node -v)"
fi

# 安装 PM2
echo ""
echo "[3/6] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "PM2 安装完成"
else
    echo "PM2 已安装"
fi

# 安装 Nginx
echo ""
echo "[4/6] 安装 Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo $PKG_MANAGER install -y nginx
    echo "Nginx 安装完成"
else
    echo "Nginx 已安装"
fi

# 部署应用
echo ""
echo "[5/6] 部署应用..."
APP_DIR="/opt/zs-app"
CURRENT_DIR=$(pwd)

# 创建目录
sudo mkdir -p $APP_DIR

# 复制文件
sudo cp -r .next $APP_DIR/
sudo cp -r public $APP_DIR/ 2>/dev/null || true
sudo cp .env.production $APP_DIR/ 2>/dev/null || true
sudo cp package.json $APP_DIR/

# 准备 standalone 目录
cd $APP_DIR
if [ -d ".next/standalone" ]; then
    sudo cp -r .next/static .next/standalone/.next/
    sudo cp -r public .next/standalone/ 2>/dev/null || true
    sudo cp .env.production .next/standalone/.env.local 2>/dev/null || true
    
    # 停止旧进程
    pm2 delete zs-app 2>/dev/null || true
    
    # 启动应用
    cd .next/standalone
    pm2 start server.js --name "zs-app"
    pm2 save
    pm2 startup | tail -1 | sudo bash
    
    echo "应用已启动在端口 3000"
else
    echo "错误: .next/standalone 目录不存在，请确保 next.config.mjs 中配置了 output: 'standalone'"
    exit 1
fi

# 配置 Nginx
echo ""
echo "[6/6] 配置 Nginx..."

NGINX_CONF="/etc/nginx/sites-available/zs-app"
if [ "$OS" = "centos" ]; then
    NGINX_CONF="/etc/nginx/conf.d/zs-app.conf"
fi

sudo tee $NGINX_CONF > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    location /_next/static/ {
        alias /opt/zs-app/.next/standalone/.next/static/;
        expires 365d;
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Ubuntu: 创建软链接
if [ "$OS" = "ubuntu" ]; then
    sudo ln -sf /etc/nginx/sites-available/zs-app /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# 测试并重启 Nginx
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "========================================"
echo "  部署完成!"
echo "========================================"
echo ""
echo "应用已部署到: $APP_DIR"
echo "访问地址: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "常用命令:"
echo "  pm2 status       # 查看应用状态"
echo "  pm2 logs zs-app  # 查看日志"
echo "  pm2 restart zs-app # 重启应用"
echo ""
