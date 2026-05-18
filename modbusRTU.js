var crcTable = null;

// 按位XOR（JUCE JS不支持 ^ 运算符，用减法循环实现）
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

// 预计算CRC16查找表（多项式 0x8005 反射 = 0xA001）
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

// CRC16 Modbus RTU，返回 [低字节, 高字节]
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

// 发送帧：加CRC后发送
function sendFrame(pdu) {
    var crc = crc16(pdu);
    pdu.push(crc[0], crc[1]);
    local.sendBytes(pdu);
}

function init() {
    script.log("ModbusRTU module loaded");
}

// 收到串口数据时回调
function dataReceived(data) {
    for (var i = 0; i < data.length; i++) {
        script.log("RX: ", data[i]);
    }
}

// 01 Read Coils：读取线圈
function read01(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x01, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 02 Read Discrete Inputs：读取离散输入
function read02(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x02, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 03 Read Holding Registers：读取保持寄存器
function read03(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x03, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 04 Read Input Registers：读取输入寄存器
function read04(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow) {
    sendFrame([DeviceAddr, 0x04, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow]);
}

// 05 Write Single Coil：写入单个线圈
function write05(DeviceAddr, RegisterHigh, RegisterLow, Status) {
    if (Status) {
        sendFrame([DeviceAddr, 0x05, RegisterHigh, RegisterLow, 0xFF, 0x00]);
    } else {
        sendFrame([DeviceAddr, 0x05, RegisterHigh, RegisterLow, 0x00, 0x00]);
    }
}

// 06 Write Single Register：写入单个保持寄存器
function write06(DeviceAddr, RegisterHigh, RegisterLow, ValueHigh, ValueLow) {
    sendFrame([DeviceAddr, 0x06, RegisterHigh, RegisterLow, ValueHigh, ValueLow]);
}

// 0F Write Multiple Coils：写入多个线圈
function write0F(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow, Coil0, Coil1, Coil2, Coil3, Coil4, Coil5, Coil6, Coil7) {
    var pdu = [DeviceAddr, 0x0F, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow];
    var qty = QuantityHigh * 256 + QuantityLow;
    var coils = [Coil0, Coil1, Coil2, Coil3, Coil4, Coil5, Coil6, Coil7];
    var byteCount = Math.floor((qty + 7) / 8);
    pdu.push(byteCount);
    for (var i = 0; i < byteCount; i++) {
        var byteVal = 0;
        var bitPos = 1;
        var maxBit = 8;
        if (i * 8 + 8 > qty) maxBit = qty - i * 8;
        for (var j = 0; j < maxBit; j++) {
            var coilIndex = i * 8 + j;
            if (coils[coilIndex]) byteVal = byteVal + bitPos;
            bitPos = bitPos * 2;
        }
        pdu.push(byteVal);
    }
    sendFrame(pdu);
}

// 10 Write Multiple Registers：写入多个保持寄存器（所有寄存器写入相同值）
function write10(DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow, DataHigh, DataLow) {
    var pdu = [DeviceAddr, 0x10, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow];
    var qty = QuantityHigh * 256 + QuantityLow;
    var byteCount = qty * 2;
    pdu.push(byteCount);
    for (var i = 0; i < qty; i++) {
        pdu.push(DataHigh, DataLow);
    }
    sendFrame(pdu);
}

// Send Raw：手动输入十六进制，自动加CRC发送
function sendRaw(HexString) {
    var hexStr = HexString;
    if (hexStr == "") return;
    var bytes = [];
    var current = "";
    for (var i = 0; i < hexStr.length; i++) {
        var c = hexStr.charAt(i);
        if (c == " ") {
            if (current != "") {
                bytes.push(hexToInt(current));
                current = "";
            }
        } else {
            current = current + c;
        }
    }
    if (current != "") bytes.push(hexToInt(current));
    if (bytes.length == 0) return;
    sendFrame(bytes);
}
