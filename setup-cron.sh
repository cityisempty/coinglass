#!/bin/bash

# 获取当前目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_FILE="$SCRIPT_DIR/scraper.log"

# 确保脚本是可执行的
chmod +x "$SCRIPT_DIR/scrape.js"

# 创建新的 cron 任务
CRON_CMD="*/5 * * * * cd $SCRIPT_DIR && /usr/bin/node $SCRIPT_DIR/scrape.js >> $LOG_FILE 2>&1"

# 检查是否已经存在相同的 cron 任务
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -F "$SCRIPT_DIR/scrape.js")

if [ -z "$EXISTING_CRON" ]; then
    # 添加新的 cron 任务
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "Cron 任务已添加: 每5分钟执行一次数据采集"
else
    echo "Cron 任务已存在，无需重复添加"
fi

# 显示当前的 cron 任务
echo "当前的 cron 任务列表:"
crontab -l
