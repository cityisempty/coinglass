require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const { main: scrapeData } = require('./main');

const app = express();
const port = process.env.PORT || 3000;

// 中间件设置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 身份验证中间件
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
}

// 登录页面
app.get('/login', (req, res) => {
    res.render('login');
});

// 登录处理
app.post('/login', (req, res) => {
    const password = req.body.password;
    if (password === process.env.APP_PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/');
    } else {
        res.render('login', { error: '密码错误'});
    }
});

// 转换时间到东八区
function convertToCST(date) {
    const utcDate = new Date(date);
    return new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
}

// 格式化时间
function formatDate(date) {
    const d = convertToCST(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 主页
app.get('/', requireAuth, async (req, res) => {
    try {
        const coins = await db.getCoins();
        const selectedCoin = req.query.coin || coins[0];
        const days = parseInt(req.query.days) || 7;
        const data = await db.getCoinData(selectedCoin, days);
        
        // 处理数据
        const processedData = data.map(row => {
            try {
                return {
                    created_at: formatDate(row.created_at),
                    coin: row.coin,
                    left_liquidation: row.left_liquidation || '0',
                    right_liquidation: row.right_liquidation || '0'
                };
            } catch (error) {
                console.error('数据处理错误:', error, row);
                return {
                    created_at: formatDate(row.created_at),
                    coin: row.coin,
                    left_liquidation: '0',
                    right_liquidation: '0'
                };
            }
        });

        // 时区设置
        const timezone = 'UTC+8 (北京时间)';
        const timezoneOffset = 8;
        
        // 渲染页面，传递时区信息
        res.render('index', { 
            coins, 
            selectedCoin,
            selectedDays: days,
            data: processedData,
            timezone,
            timezoneOffset
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('服务器错误');
    }
});

// API 路由
app.get('/api/data/:coin', requireAuth, async (req, res) => {
    try {
        const data = await db.getCoinData(req.params.coin);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: '服务器错误' });
    }
});

// 清理数据路由
app.post('/api/clean-data', requireAuth, async (req, res) => {
    try {
        const deletedCount = await db.cleanOldData();
        res.json({ 
            success: true, 
            message: `成功清理 ${deletedCount} 条4小时前的数据`
        });
    } catch (error) {
        console.error('清理数据失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '清理数据失败: ' + error.message 
        });
    }
});

// 清理数据路由
app.post('/api/clean-data/:days', requireAuth, async (req, res) => {
    try {
        const days = parseInt(req.params.days);
        if (isNaN(days) || days < 0) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的天数参数'
            });
        }

        const deletedCount = await db.cleanDataBeforeDays(days);
        const message = days === 0 
            ? `成功清理所有数据（${deletedCount}条）` 
            : `成功清理${days}天前的数据（${deletedCount}条）`;

        res.json({ 
            success: true, 
            message: message
        });
    } catch (error) {
        console.error('清理数据失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '清理数据失败: ' + error.message 
        });
    }
});

// 定时执行爬虫
async function scheduleScrapingTask() {
    const INTERVAL = 5 * 60 * 1000; // 5分钟
    
    async function runTask() {
        try {
            console.log('开始执行数据采集任务:', new Date().toLocaleString());
            await scrapeData();
            console.log('数据采集任务完成:', new Date().toLocaleString());
        } catch (error) {
            console.error('数据采集任务失败:', error);
        }
    }

    // 立即执行一次
    await runTask();

    // 设置定时器
    setInterval(runTask, INTERVAL);
}

// 启动定时任务
scheduleScrapingTask().catch(console.error);

// 初始化数据库并启动服务器
db.initDatabase()
    .then(() => {
        app.listen(port, () => {
            console.log(`服务器运行在 http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('数据库初始化失败:', err);
        process.exit(1);
    });
