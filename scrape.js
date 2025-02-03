#!/usr/bin/env node

const { main } = require('./main');
const path = require('path');

// 确保在正确的目录中运行
process.chdir(__dirname);

// 加载环境变量
require('dotenv').config();

async function runScraper() {
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] 开始数据采集...`);
    
    try {
        await main();
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`[${endTime.toISOString()}] 数据采集完成，耗时 ${duration} 秒`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 数据采集失败:`, error);
        process.exit(1);
    }
}

// 运行采集器
runScraper();
