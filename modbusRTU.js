var crcTable = null;

// CRC16 按位异或（JUCE JS 无 ^ 运算符）
function xorBits(a, b, bits) {
    var result = 0;
    var bitVal = 1;
    for (var i = 0; i < bits; i++) {
        var aBit = a % 2;
        var bBit = b % 2;
        if (aBit != bBit) result = result + bitVal;
        a = Math.floor(a / 2);
        b = Math.floor(b / 2);
        bitVal = bitVal * 2;
    }
    return result;
}

// 预计算 CRC16 查表（多项式 0x8005 反射 = 0xA001）
function initCRCTable() {
    crcTable = [];
    for (var i = 0; i < 256; i++) {
        var crc = i;
        for (var j = 0; j < 8; j++) {
            if (crc % 2 == 0) {
                crc = Math.floor(crc / 2);
            } else {
                crc = Math.floor(crc / 2);
                crc = xorBits(crc, 0xA001, 16);
            }
        }
        crcTable.push(crc);
    }
}

// CRC16 Modbus，返回 [低字节, 高字节]
function crc16(data) {
    if (crcTable == null) initCRCTable();
    var crc = 0xFFFF;
    for (var i = 0; i < data.length; i++) {
        var index = xorBits(crc % 256, data[i], 8);
        crc = xorBits(Math.floor(crc / 256), crcTable[index], 16);
    }
    return [crc % 256, Math.floor(crc / 256)];
}

// 十六进制字符串 → 整数
function hexToInt(hex) {
    var digits = "0123456789ABCDEF";
    hex = hex.toUpperCase();
    var val = 0;
    for (var i = 0; i < hex.length; i++) {
        var c = hex.charAt(i);
        for (var j = 0; j < 16; j++) {
            if (c == digits.charAt(j)) {
                val = val * 16 + j;
                break;
            }
        }
    }
    return val;
}

// 整数 → 两位十六进制字符串
function toHex(val) {
    var d = "0123456789ABCDEF";
    return d.charAt(Math.floor(val / 16)) + d.charAt(val % 16);
}

// 字节数组 → 空格分隔的十六进制字符串
function bytesToStr(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
        if (i > 0) s = s + " ";
        s = s + toHex(bytes[i]);
    }
    return s;
}

// 加 CRC 并发送，输出 TX 日志
function sendFrame(pdu) {
    var c = crc16(pdu);
    pdu.push(c[0], c[1]);
    script.log("-TX: " + bytesToStr(pdu));
    local.sendBytes(pdu);
}

// 模块初始化
function init() {
    script.log("Modbus RTU Master loaded");
}

// 收到串口数据时回调，输出 RX 日志
function dataReceived(data) {
    if (data.length > 0) {
        script.log("-RX: " + bytesToStr(data));
    }
}

// ==== Modbus 功能码命令 ====

// 01: 读取线圈
function readCoils(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x01, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 02: 读取离散输入
function readDiscreteInputs(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x02, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 03: 读取保持寄存器
function readHoldingRegisters(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x03, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 04: 读取输入寄存器
function readInputRegisters(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x04, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 05: 写入单个线圈
function writeSingleCoil(DeviceAddr, RegisterHigh, RegisterLow, Status) {
    if (Status) {
        sendFrame([DeviceAddr, 0x05, RegisterHigh, RegisterLow, 0xFF, 0x00]);
    } else {
        sendFrame([DeviceAddr, 0x05, RegisterHigh, RegisterLow, 0x00, 0x00]);
    }
}

// 06: 写入单个保持寄存器
function writeSingleRegister(DeviceAddr, RegisterHigh, RegisterLow, ValueHigh, ValueLow) {
    sendFrame([DeviceAddr, 0x06, RegisterHigh, RegisterLow, ValueHigh, ValueLow]);
}

// 0F: 写入多个线圈（最多 8 路）
function writeMultipleCoils(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow, Coil0, Coil1, Coil2, Coil3, Coil4, Coil5, Coil6, Coil7) {
    var pdu = [DeviceAddr, 0x0F, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow];
    var qty = QuantityHigh * 256 + QuantityLow;
    var byteCount = Math.floor((qty + 7) / 8);
    pdu.push(byteCount);
    for (var i = 0; i < byteCount; i++) {
        var byteVal = 0;
        var bitPos = 1;
        var maxBit = 8;
        if (i * 8 + 8 > qty) maxBit = qty - i * 8;
        for (var j = 0; j < maxBit; j++) {
            if ([Coil0, Coil1, Coil2, Coil3, Coil4, Coil5, Coil6, Coil7][i * 8 + j]) byteVal = byteVal + bitPos;
            bitPos = bitPos * 2;
        }
        pdu.push(byteVal);
    }
    sendFrame(pdu);
}

// 10: 写入多个保持寄存器（所有寄存器写入相同值）
function writeMultipleRegisters(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow, DataHigh, DataLow) {
    var pdu = [DeviceAddr, 0x10, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow];
    var qty = QuantityHigh * 256 + QuantityLow;
    pdu.push(qty * 2);
    for (var i = 0; i < qty; i++) {
        pdu.push(DataHigh, DataLow);
    }
    sendFrame(pdu);
}

// ==== 通用 ====

// 发送原始十六进制（自动加 CRC）
function sendRaw(HexString) {
    if (HexString == "") return;
    var bytes = [];
    var cur = "";
    for (var i = 0; i < HexString.length; i++) {
        var c = HexString.charAt(i);
        if (c == " ") {
            if (cur != "") { bytes.push(hexToInt(cur)); cur = ""; }
        } else {
            cur = cur + c;
        }
    }
    if (cur != "") bytes.push(hexToInt(cur));
    if (bytes.length > 0) sendFrame(bytes);
}
