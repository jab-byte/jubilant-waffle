#!/bin/bash
# 南京中考招生系统 - 启动脚本

set -e

echo "========================================="
echo "南京中考招生系统 - 启动中..."
echo "========================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 错误：未找到 pnpm，请先运行：npm install -g pnpm"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查 .next 文件夹
if [ ! -d ".next" ]; then
    echo "❌ 错误：未找到 .next 文件夹，应用未构建"
    exit 1
fi

# 检查环境变量
if [ ! -f ".env.local" ]; then
    echo "❌ 错误：未找到 .env.local 文件"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    pnpm install --prod
fi

# 启动应用
echo ""
echo "✅ 应用启动中..."
echo "🌐 访问地址：http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止应用"
echo ""

NODE_ENV=production exec node .next/standalone/server.js
