#!/usr/bin/env python3
"""Modbus RTU slave test - reads from stdin, writes to stdout (pipe mode)."""
import sys, os, select, struct, time

CRC16_TABLE = None

def _make_crc16_table():
    t = []
    for i in range(256):
        crc = i
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
        t.append(crc)
    return t

def _crc16(data):
    global CRC16_TABLE
    if CRC16_TABLE is None:
        CRC16_TABLE = _make_crc16_table()
    crc = 0xFFFF
    for b in data:
        crc = (crc >> 8) ^ CRC16_TABLE[(crc ^ b) & 0xFF]
    return crc

def _build_frame(addr, fcode, data):
    frame = bytes([addr, fcode]) + data
    crc = _crc16(frame)
    return frame + struct.pack('<H', crc)

def _build_exception(addr, fcode, exc):
    return _build_frame(addr, fcode | 0x80, bytes([exc]))

def _check_crc(frame):
    if len(frame) < 2:
        return False
    return struct.unpack('<H', frame[-2:])[0] == _crc16(frame[:-2])

def _hex(data):
    return ' '.join(f'{b:02x}' for b in data)

def handle_request(frame):
    if len(frame) < 4:
        return None
    addr = frame[0]
    fcode = frame[1]
    data = frame[2:-2]

    if fcode == 0x01:
        start, qty = struct.unpack('>HH', data[:4])
        nb = (qty + 7) // 8
        payload = bytes([nb]) + bytes([0xFF if i % 2 == 0 else 0x00 for i in range(nb)])
        return _build_frame(addr, fcode, payload)
    elif fcode == 0x02:
        start, qty = struct.unpack('>HH', data[:4])
        nb = (qty + 7) // 8
        payload = bytes([nb]) + bytes([0xFF if i % 2 == 0 else 0x00 for i in range(nb)])
        return _build_frame(addr, fcode, payload)
    elif fcode == 0x03:
        start, qty = struct.unpack('>HH', data[:4])
        regs = b''.join(struct.pack('>H', (start + i) & 0xFFFF) for i in range(qty))
        return _build_frame(addr, fcode, bytes([qty * 2]) + regs)
    elif fcode == 0x04:
        start, qty = struct.unpack('>HH', data[:4])
        regs = b''.join(struct.pack('>H', (0xFFFF - (start + i)) & 0xFFFF) for i in range(qty))
        return _build_frame(addr, fcode, bytes([qty * 2]) + regs)
    elif fcode in (0x05, 0x06):
        return frame
    elif fcode == 0x0F:
        start, qty = struct.unpack('>HH', data[:4])
        return _build_frame(addr, fcode, struct.pack('>HH', start, qty))
    elif fcode == 0x10:
        start, qty = struct.unpack('>HH', data[:4])
        return _build_frame(addr, fcode, struct.pack('>HH', start, qty))
    else:
        return _build_exception(addr, fcode, 0x01)

def main():
    slave_addr = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    fd_in = sys.stdin.buffer
    fd_out = sys.stdout.buffer

    print(f"Modbus RTU Slave (address={slave_addr})", file=sys.stderr)
    print("Using stdin/stdout pipe mode", file=sys.stderr)
    print("Press Ctrl+C to stop.", file=sys.stderr)
    sys.stderr.flush()

    TIMEOUT = 0.02
    buf = bytearray()
    last = time.time()

    try:
        while True:
            r, _, _ = select.select([fd_in], [], [], TIMEOUT)
            if r:
                chunk = os.read(fd_in.fileno(), 256)
                if not chunk:
                    break
                buf.extend(chunk)
                last = time.time()

            if buf and (time.time() - last) >= TIMEOUT:
                frame = bytes(buf)
                buf.clear()
                print(f"RX: {_hex(frame)}", file=sys.stderr)
                sys.stderr.flush()

                if not _check_crc(frame):
                    addr = frame[0]
                    fcode = frame[1]
                    resp = _build_exception(addr, fcode, 0x04)
                    fd_out.write(resp)
                    fd_out.flush()
                    print(f"TX: {_hex(resp)} (CRC error)", file=sys.stderr)
                    sys.stderr.flush()
                    continue

                addr = frame[0]
                if addr == slave_addr:
                    resp = handle_request(frame)
                    if resp:
                        fd_out.write(resp)
                        fd_out.flush()
                        print(f"TX: {_hex(resp)}", file=sys.stderr)
                        sys.stderr.flush()
    except KeyboardInterrupt:
        print("\nShutting down...", file=sys.stderr)

if __name__ == '__main__':
    main()
