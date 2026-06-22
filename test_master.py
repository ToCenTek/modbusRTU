#!/usr/bin/env python3
"""Modbus RTU 主站测试 - 完整测试所有 9 条命令"""
import sys, os, select, struct, time, termios

CRC16_TABLE = None
def _crc16(data):
    global CRC16_TABLE
    if CRC16_TABLE is None:
        t = []
        for i in range(256):
            crc = i
            for _ in range(8):
                if crc & 1: crc = (crc >> 1) ^ 0xA001
                else: crc >>= 1
            t.append(crc)
        CRC16_TABLE = t
    crc = 0xFFFF
    for b in data:
        crc = (crc >> 8) ^ CRC16_TABLE[(crc ^ b) & 0xFF]
    return crc

def _hex(d): return ' '.join(f'{b:02x}' for b in d)
def _make_frame(data):
    return data + struct.pack('<H', _crc16(data))

def _recv(fd, timeout=0.5):
    buf = bytearray()
    while True:
        r, _, _ = select.select([fd], [], [], timeout)
        if not r: break
        chunk = os.read(fd, 256)
        if not chunk: break
        buf.extend(chunk)
    return bytes(buf)

PORT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/tty_modbus"
PORT = os.path.realpath(PORT)

print(f"连接串口: {PORT}")
fd = os.open(PORT, os.O_RDWR | os.O_NOCTTY)
attrs = termios.tcgetattr(fd)
attrs[0] &= ~(termios.IGNBRK | termios.BRKINT | termios.PARMRK | termios.ISTRIP | termios.INLCR | termios.IGNCR | termios.ICRNL | termios.IXON)
attrs[1] &= ~termios.OPOST
attrs[2] &= ~(termios.CSIZE | termios.PARENB)
attrs[2] |= termios.CS8
attrs[3] &= ~(termios.ECHO | termios.ECHONL | termios.ICANON | termios.ISIG | termios.IEXTEN)
termios.tcsetattr(fd, termios.TCSANOW, attrs)

def test(name, frame, check_resp):
    frame_bytes = _make_frame(frame)
    os.write(fd, frame_bytes)
    resp = _recv(fd)
    ok, msg = check_resp(frame_bytes, resp)
    status = "✓" if ok else "✗"
    print(f"  {status} {name}")
    print(f"    TX: {_hex(frame_bytes)}")
    print(f"    RX: {_hex(resp) if resp else '(无响应)'}")
    if msg: print(f"    {msg}")
    print()
    return ok

def check_ok(tx, rx):
    if len(rx) < 4: return False, f"响应太短 ({len(rx)} 字节)"
    if rx[1] & 0x80: return False, f"异常响应: {_hex(rx)}"
    if rx[0] != tx[0]: return False, f"从站地址不匹配: TX={tx[0]:02x}, RX={rx[0]:02x}"
    if rx[1] != tx[1]: return False, f"功能码不匹配: TX={tx[1]:02x}, RX={rx[1]:02x}"
    # If response is an echo (write commands), compare full frame
    if len(rx) == len(tx):
        if rx != tx: return False, "响应内容不匹配"
    return True, ""

passed = total = 0

print(f"\n=== 测试 Modbus RTU 从站 (地址=1) ===\n")

print("1) 01-Read Coils (addr=1, start=0x0000, qty=8)")
if test("Coil status: FF (all ON)", bytes([0x01, 0x01, 0x00, 0x00, 0x00, 0x08]), check_ok): passed += 1
total += 1

print("2) 02-Read Discrete Inputs (addr=1, start=0x0000, qty=8)")
if test("Input status: FF (all ON)", bytes([0x01, 0x02, 0x00, 0x00, 0x00, 0x08]), check_ok): passed += 1
total += 1

print("3) 03-Read Holding Registers (addr=1, start=0x0000, qty=3)")
if test("Values: 0x0000, 0x0001, 0x0002", bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x03]), check_ok): passed += 1
total += 1

print("4) 04-Read Input Registers (addr=1, start=0x0000, qty=3)")
if test("Values: 0xFFFF, 0xFFFE, 0xFFFD", bytes([0x01, 0x04, 0x00, 0x00, 0x00, 0x03]), check_ok): passed += 1
total += 1

print("5) 05-Write Single Coil")
if test("ON  (0xFF00)", bytes([0x01, 0x05, 0x00, 0x00, 0xFF, 0x00]), check_ok): passed += 1
total += 1
if test("OFF (0x0000)", bytes([0x01, 0x05, 0x00, 0x00, 0x00, 0x00]), check_ok): passed += 1
total += 1

print("6) 06-Write Single Register (val=0x1234)")
if test("Echo response", bytes([0x01, 0x06, 0x00, 0x00, 0x12, 0x34]), check_ok): passed += 1
total += 1

print("7) 0F-Write Multiple Coils (qty=8, all ON)")
if test("Start=0, Qty=8", bytes([0x01, 0x0F, 0x00, 0x00, 0x00, 0x08, 0x01, 0xFF]), check_ok): passed += 1
total += 1

print("8) 10-Write Multiple Registers (qty=2, val=0xAAAA)")
if test("Start=0, Qty=2", bytes([0x01, 0x10, 0x00, 0x00, 0x00, 0x02, 0x04, 0xAA, 0xAA, 0xAA, 0xAA]), check_ok): passed += 1
total += 1

print("9) Send Raw (03 Read Holding Regs, qty=5)")
if test("Values: 0x0000~0x0004", bytes([0x01, 0x03, 0x00, 0x00, 0x00, 0x05]), check_ok): passed += 1
total += 1

os.close(fd)
print(f"结果: {passed}/{total} 通过 ({passed*100/total:.0f}%)")
