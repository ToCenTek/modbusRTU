#!/bin/bash
# setup_modbus_slave.sh - 设置虚拟串口 Modbus 从站测试环境

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Modbus RTU Slave 测试环境 ==="
echo ""

# 检查 socat 是否运行
if ps aux | grep -v grep | grep "socat.*modbus_slave" > /dev/null; then
    PTY=$(cat /tmp/socat_slave.log 2>/dev/null | grep "PTY is" | grep -o '/dev/ttys[0-9a-f]*' | tail -1)
    echo "✓ 从站已运行, 端口: $PTY"
else
    echo "正在启动从站..."
    nohup socat -d -d PTY,link=/tmp/tty_modbus,raw,echo=0 \
        "EXEC:python3 ${DIR}/modbus_slave.py 1" \
        >/tmp/socat_slave.log 2>&1 &
    disown
    sleep 2
    PTY=$(cat /tmp/socat_slave.log 2>/dev/null | grep "PTY is" | grep -o '/dev/ttys[0-9a-f]*' | tail -1)
    echo "✓ 从站已启动, 端口: $PTY"
fi

echo ""
echo "创建 /dev/cu.modbus 软链 (需要管理员密码)..."
sudo ln -sf "$PTY" /dev/cu.modbus 2>/dev/null &&
    echo "✓ /dev/cu.modbus -> $PTY" ||
    echo "✗ 创建失败，请手动运行: sudo ln -sf $PTY /dev/cu.modbus"

echo ""
echo "=== 使用说明 ==="
echo "1. 打开 Chataigne"
echo "2. 添加模块 → 选择 ToCenTek-modbus-RTU"
echo "3. 串口设置: Port = cu.modbus"
echo "4. 发送命令测试"
echo ""
echo "停止测试: kill $(pgrep -f 'socat.*modbus_slave' 2>/dev/null)"
echo "运行测试: python3 ${DIR}/test_master.py"
