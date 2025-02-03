# Ubuntu 服务器部署指南

## 1. 系统要求
- Ubuntu 20.04 LTS
- Node.js v16+ 
- Google Chrome
- Git

## 2. 安装依赖

### 安装 Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 安装 Chromium 依赖
```bash
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils
```

## 3. 部署应用

### 克隆代码
```bash
git clone <你的仓库地址>
cd coinglass
```

### 安装项目依赖
```bash
# 安装依赖
npm install

# 如果在安装 Puppeteer 时遇到问题，可以尝试：
npm install puppeteer --unsafe-perm=true
```

### 配置环境变量
复制 .env.example 到 .env 并修改配置：
```bash
cp .env.example .env
nano .env
```

配置以下环境变量：
```
PORT=3000
APP_PASSWORD=你的密码
SESSION_SECRET=你的会话密钥
DB_PATH=./liquidation.db
SCRAPE_INTERVAL=300000
```

### 使用 PM2 运行应用
安装 PM2:
```bash
sudo npm install -g pm2
```

启动应用：
```bash
pm2 start server.js --name coinglass
```

设置开机自启：
```bash
pm2 startup
pm2 save
```

## 4. 查看日志

查看应用日志：
```bash
pm2 logs coinglass
```

## 5. 常见问题

### 1. Puppeteer 启动失败
如果遇到权限问题，尝试以下命令：
```bash
# 添加必要的系统权限
sudo sysctl -w kernel.unprivileged_userns_clone=1

# 如果使用的是非 root 用户，确保用户在 chrome-sandbox 组中
sudo groupadd chrome-sandbox
sudo usermod -a -G chrome-sandbox $USER
```

### 2. 内存不足
如果服务器内存较小，可以在 PM2 启动时添加内存限制：
```bash
pm2 start server.js --name coinglass --max-memory-restart 1G
```

### 3. 权限问题
确保应用目录有正确的权限：
```bash
sudo chown -R $USER:$USER /path/to/coinglass
```

### 4. 如果仍然遇到 Chromium 启动问题
尝试以下命令：
```bash
# 设置 CHROME_DEVEL_SANDBOX 环境变量
echo "export CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox" >> ~/.bashrc
source ~/.bashrc

# 创建并设置 sandbox
sudo chown root:root node_modules/puppeteer/.local-chromium/*/chrome-linux/chrome_sandbox
sudo chmod 4755 node_modules/puppeteer/.local-chromium/*/chrome-linux/chrome_sandbox
sudo cp -p node_modules/puppeteer/.local-chromium/*/chrome-linux/chrome_sandbox /usr/local/sbin/chrome-devel-sandbox
