#!/bin/bash

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "Node.js 未安装"
    exit 1
fi

# 检查环境变量文件
if [ ! -f .env ]; then
    echo ".env 文件不存在"
    exit 1
fi

# 安装依赖
echo "正在安装依赖..."
npm install

# 设置 cron 任务
echo "设置数据采集的 cron 任务..."
chmod +x setup-cron.sh
./setup-cron.sh

# 启动 web 服务
if command -v pm2 &> /dev/null; then
    echo "使用 PM2 启动 web 服务..."
    pm2 delete coinglass 2>/dev/null || true
    pm2 start server.js --name coinglass
else
    echo "使用 Node.js 启动 web 服务..."
    node server.js
fi
