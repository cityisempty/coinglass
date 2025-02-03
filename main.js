const puppeteer = require('puppeteer');
const db = require('./db');

// 配置
const config = {
    url: 'https://www.coinglass.com/pro/dashboard/bitcoin',
    chartSelector: '#id-grid-91e35352-c45e-4d38-af58-c4e0099f4331',
    coinSelectorParent: '#id-grid-91e35352-c45e-4d38-af58-c4e0099f4331 .MuiAutocomplete-root',
    coins: ['BTC', 'ETH', 'SOL', 'DOGE', 'LTC', 'BIGTIME', 'WLD', 'MEW'],
    positions: {
        leftTop: { 
            offsetX: 137, 
            offsetY: 100,
            description: '左上角'
        },
        rightTop: { 
            offsetX: 693, 
            offsetY: 100,
            description: '右上角'
        }
    }
};

// 解析悬浮层数据
async function parseTooltipContent(tooltipElement, page) {
    const data = await page.evaluate(el => {
        // 获取完整的HTML结构用于调试
        const html = el.innerHTML;
        console.log('悬浮层HTML:', html);

        // 获取标题（时间戳）
        const title = el.querySelector('.cg-toolti-title')?.textContent || '';

        // 获取所有数据项
        const items = Array.from(el.querySelectorAll('.cg-tooltip-item')).map(item => {
            const titleEl = item.querySelector('.cg-tooltip-item-title');
            const valueEl = item.querySelector('.pl20');
            return {
                title: titleEl?.textContent?.trim() || '',
                value: valueEl?.textContent?.trim() || ''
            };
        });

        return { title, items };
    }, tooltipElement);

    console.log('解析到的数据:', JSON.stringify(data, null, 2));

    // 查找清算数据
    const liquidationItem = data.items.find(item => 
        item.title.includes('Liquidation') || 
        item.title.includes('清算')
    );

    if (liquidationItem) {
        console.log('找到清算数据:', liquidationItem);
        return {
            timestamp: data.title,
            value: liquidationItem.value
        };
    } else {
        console.log('未找到清算数据');
        return {
            timestamp: data.title,
            value: ''
        };
    }
}

// 切换币种
async function switchCoin(page, coin) {
    console.log(`\n切换到币种: ${coin}`);
    
    try {
        // 找到特定图表内的选择框
        const coinSelectorParent = await page.waitForSelector(config.coinSelectorParent);
        if (!coinSelectorParent) {
            throw new Error('未找到币种选择框');
        }

        // 获取选择框的位置信息
        const parentBox = await coinSelectorParent.boundingBox();
        if (!parentBox) {
            throw new Error('无法获取选择框位置');
        }

        // 点击选择框打开下拉列表
        await coinSelectorParent.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 在图表内找到输入框
        const input = await page.evaluateHandle(selector => {
            const parent = document.querySelector(selector);
            return parent ? parent.querySelector('input') : null;
        }, config.coinSelectorParent);

        if (!input) {
            throw new Error('未找到币种输入框');
        }

        // 清除现有内容
        await page.evaluate(el => el.value = '', input);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 输入新的币种
        await input.type(coin);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 移动鼠标到输入框下方并点击
        const inputBox = await input.boundingBox();
        if (!inputBox) {
            throw new Error('无法获取输入框位置');
        }

        // 移动到输入框下方约一个输入框高度的位置
        const clickX = inputBox.x + inputBox.width / 2;
        const clickY = inputBox.y + inputBox.height * 2;
        
        console.log(`移动鼠标到: x=${clickX}, y=${clickY}`);
        await page.mouse.move(clickX, clickY);
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.mouse.click(clickX, clickY);

        // 等待图表更新
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 验证切换是否成功
        const titleSelector = '#id-grid-91e35352-c45e-4d38-af58-c4e0099f4331 .pro-grid-layout-head-title';
        const title = await page.$eval(titleSelector, el => el.getAttribute('title'));
        console.log(`当前图表标题: ${title}`);
        
        if (!title || !title.includes(coin)) {
            throw new Error(`币种切换失败: 期望图表标题包含 ${coin}, 实际标题为 ${title}`);
        }

        console.log(`成功切换到: ${coin}`);
        return true;
    } catch (error) {
        console.error(`切换币种失败 ${coin}:`, error);
        return false;
    }
}

// 检查图表是否已更新
async function waitForChartUpdate(page) {
    console.log('等待图表更新...');
    
    try {
        // 等待特定图表内的loading消失
        const loadingSelector = `${config.chartSelector} .loading-content, ${config.chartSelector} .loading`;
        await page.waitForFunction((selector) => {
            const loadingElements = document.querySelectorAll(selector);
            return Array.from(loadingElements).every(el => !el || el.style.display === 'none');
        }, { timeout: 10000 }, loadingSelector);

        // 检查图表数据是否已更新
        await page.waitForFunction((selector) => {
            const chart = document.querySelector(selector);
            return chart && chart.querySelector('svg') && chart.querySelector('svg').children.length > 0;
        }, { timeout: 10000 }, config.chartSelector);

        // 额外等待一段时间确保数据已加载
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return true;
    } catch (error) {
        console.warn(`等待图表更新超时: ${error.message}`);
        return false;
    }
}

// 获取悬浮层内容
async function getTooltipContent(page, mouseX, mouseY, positionDesc) {
    console.log(`[${positionDesc}] 移动鼠标到位置: x=${mouseX}, y=${mouseY}`);
    
    try {
        // 移动鼠标前，确保没有显示悬浮层
        await page.mouse.move(0, 0);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 移动到目标位置
        await page.mouse.move(mouseX, mouseY);
        console.log('等待悬浮层出现...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 检查悬浮层是否出现
        const tooltipElement = await page.$('.cg-toolti-box');
        if (tooltipElement) {
            console.log(`[${positionDesc}] 找到悬浮层`);
            
            // 获取悬浮层位置信息
            const tooltipBox = await tooltipElement.boundingBox();
            console.log(`[${positionDesc}] 悬浮层位置:`, tooltipBox);

            // // 截图保存（用于调试）
            // await page.screenshot({
            //     path: `tooltip-${positionDesc}-${Date.now()}.png`,
            //     fullPage: true
            // });

            const content = await parseTooltipContent(tooltipElement, page);
            console.log(`[${positionDesc}] 解析数据:`, content);

            return {
                position: positionDesc,
                coordinates: `x=${mouseX}, y=${mouseY}`,
                value: content.value,
                timestamp: content.timestamp
            };
        } else {
            console.log(`[${positionDesc}] 未找到悬浮层`);
            return {
                position: positionDesc,
                coordinates: `x=${mouseX}, y=${mouseY}`,
                error: '未找到悬浮层'
            };
        }
    } catch (error) {
        console.error(`[${positionDesc}] 获取悬浮层失败:`, error);
        return {
            position: positionDesc,
            coordinates: `x=${mouseX}, y=${mouseY}`,
            error: error.message
        };
    }
}

// 采集单个币种的数据
async function collectCoinData(page, coin) {
    console.log(`\n开始采集 ${coin} 数据...`);
    
    try {
        // 等待图表加载
        await page.waitForSelector(config.chartSelector, { 
            timeout: 15000,
            visible: true 
        });

        // 确保图表已更新
        await waitForChartUpdate(page);
        
        const element = await page.$(config.chartSelector);
        if (!element) {
            throw new Error('未找到目标图表');
        }

        const boundingBox = await element.boundingBox();
        console.log('图表位置信息:', boundingBox);

        // 获取左上角数据
        const leftData = await getTooltipContent(
            page,
            boundingBox.x + config.positions.leftTop.offsetX,
            boundingBox.y + config.positions.leftTop.offsetY,
            config.positions.leftTop.description
        );

        // 等待一下，确保前一个悬浮层消失
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 获取右上角数据
        const rightData = await getTooltipContent(
            page,
            boundingBox.x + config.positions.rightTop.offsetX,
            boundingBox.y + config.positions.rightTop.offsetY,
            config.positions.rightTop.description
        );

        // 保存到数据库
        await db.insertData(
            coin,
            { timestamp: leftData.timestamp, value: leftData.value },
            { timestamp: rightData.timestamp, value: rightData.value }
        );

        return true;
    } catch (error) {
        console.error(`采集 ${coin} 数据失败:`, error);
        return false;
    }
}

// 启动浏览器
async function initBrowser() {
    // 检测操作系统
    const os = require('os');
    const platform = os.platform();
    
    const launchOptions = {
        headless: platform === 'darwin' ? false : 'new', // Mac使用有头模式，Ubuntu使用无头模式
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--window-size=1920x1080'
        ],
        defaultViewport: {
            width: 1920,
            height: 1080
        }
    };

    // Mac特定配置
    if (platform === 'darwin') {
        launchOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
        // Ubuntu服务器特定配置
        launchOptions.args.push('--disable-gpu');
    }

    let retries = 3;
    while (retries > 0) {
        try {
            console.log(`正在启动浏览器... (剩余尝试次数: ${retries})`);
            const browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();

            // 设置页面超时
            await page.setDefaultNavigationTimeout(30000);
            await page.setDefaultTimeout(30000);

            // 设置用户代理
            const userAgent = platform === 'darwin' 
                ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
            await page.setUserAgent(userAgent);

            // 添加调试信息
            page.on('console', msg => console.log('浏览器控制台:', msg.text()));

            return { browser, page };
        } catch (error) {
            console.error('浏览器启动失败:', error);
            retries--;
            if (retries === 0) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// 主函数
async function main() {
    console.log('启动浏览器...');
    const { browser, page } = await initBrowser();
    
    try {
        // 初始化数据库
        await db.initDatabase();

        // 导航到目标页面
        console.log('导航到目标页面...');
        await page.goto(config.url, { waitUntil: 'networkidle0' });

        // 等待网络请求完成
        try {
            await page.waitForResponse(
                response => response.url().includes('wss.coinglass.com'),
                { timeout: 5000 }
            );
        } catch (error) {
            console.log('等待网络请求超时，继续执行');
        }

        // 采集数据
        for (const coin of config.coins) {
            try {
                // 切换到目标币种
                const switchSuccess = await switchCoin(page, coin);
                if (!switchSuccess) {
                    console.error(`切换到 ${coin} 失败，跳过数据采集`);
                    continue;
                }

                const success = await collectCoinData(page, coin);
                if (!success) {
                    console.error(`采集 ${coin} 数据失败`);
                }
            } catch (error) {
                console.error(`采集 ${coin} 数据失败:`, error);
            }
        }

        console.log('数据采集完成');
    } catch (error) {
        console.error('发生错误:', error);
        throw error;
    } finally {
        // 关闭浏览器
        if (browser) {
            await browser.close();
        }
    }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
    main().catch(error => {
        console.error('程序执行失败:', error);
        process.exit(1);
    });
}

module.exports = {
    main
};
