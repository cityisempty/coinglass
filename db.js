const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'liquidation.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库
function initDatabase() {
    return new Promise((resolve, reject) => {
        const sql = `
            CREATE TABLE IF NOT EXISTS liquidation_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coin TEXT,
                timestamp TEXT,
                left_liquidation TEXT,
                right_liquidation TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        db.run(sql, (err) => {
            if (err) {
                console.error('创建数据表失败:', err);
                reject(err);
            } else {
                console.log('数据表初始化成功');
                resolve();
            }
        });
    });
}

// 插入数据
function insertData(coin, leftData, rightData) {
    return new Promise((resolve, reject) => {
        if (!coin || !leftData || !rightData) {
            reject(new Error('数据格式错误: 缺少必要字段'));
            return;
        }

        const sql = `
            INSERT INTO liquidation_data (coin, timestamp, left_liquidation, right_liquidation)
            VALUES (?, ?, ?, ?)
        `;
        
        const params = [
            coin || '',
            leftData?.timestamp || '',
            leftData?.value || '',
            rightData?.value || ''
        ];
        
        console.log('准备插入数据:', params);

        db.run(sql, params, function(err) {
            if (err) {
                console.error('插入数据失败:', err);
                reject(err);
            } else {
                console.log(`成功插入数据，ID: ${this.lastID}`);
                resolve(this.lastID);
            }
        });
    });
}

// 获取所有币种
function getCoins() {
    return new Promise((resolve, reject) => {
        db.all('SELECT DISTINCT coin FROM liquidation_data ORDER BY coin', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows.map(row => row.coin));
            }
        });
    });
}

// 获取指定币种的数据
function getCoinData(coin, days = 7) {
    return new Promise((resolve, reject) => {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);
        
        const query = `
            SELECT * FROM liquidation_data 
            WHERE coin = ? 
            AND created_at >= datetime(?)
            ORDER BY created_at DESC 
            LIMIT 1000
        `;
        
        db.all(query, [coin, daysAgo.toISOString()], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                // 对于5天及以上的时间区间，每5条数据取1条
                if (days >= 5) {
                    const sampledRows = rows.filter((_, index) => index % 5 === 0);
                    resolve(sampledRows);
                } else {
                    resolve(rows);
                }
            }
        });
    });
}

// 清理4小时前的数据
async function cleanOldData() {
    return new Promise((resolve, reject) => {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const sql = `DELETE FROM liquidation_data WHERE created_at < ?`;
        
        db.run(sql, [fourHoursAgo.toISOString()], function(err) {
            if (err) {
                console.error('清理旧数据失败:', err);
                reject(err);
            } else {
                console.log(`成功清理 ${this.changes} 条旧数据`);
                resolve(this.changes);
            }
        });
    });
}

// 清理旧数据
function cleanOldData30() {
    return new Promise((resolve, reject) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        db.run(
            'DELETE FROM liquidation_data WHERE timestamp < ?',
            [thirtyDaysAgo.toISOString()],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

// 清理指定天数前的数据
function cleanDataBeforeDays(days) {
    return new Promise((resolve, reject) => {
        let query;
        let params = [];

        if (days === 0) {
            // 清理所有数据
            query = 'DELETE FROM liquidation_data';
        } else {
            // 清理指定天数前的数据
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - days);
            query = 'DELETE FROM liquidation_data WHERE created_at < datetime(?)';
            params = [daysAgo.toISOString()];
        }

        db.run(query, params, function(err) {
            if (err) {
                console.error(`清理${days}天前数据失败:`, err);
                reject(err);
            } else {
                console.log(`成功清理${days}天前数据，影响行数: ${this.changes}`);
                resolve(this.changes);
            }
        });
    });
}

// 初始化数据库
initDatabase().catch(console.error);

module.exports = {
    initDatabase,
    insertData,
    getCoins,
    getCoinData,
    cleanOldData,
    cleanOldData30,
    cleanDataBeforeDays
};
