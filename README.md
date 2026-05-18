# ToCenTek Modbus RTU

Chataigne custom module for Modbus RTU communication over Serial.

## Commands

| # | Command | Parameters | Description |
|---|---------|-----------|-------------|
| 01 | Read Coils | DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow | Read coil status |
| 02 | Read Discrete Inputs | DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow | Read discrete input status |
| 03 | Read Holding Registers | DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow | Read holding register values |
| 04 | Read Input Registers | DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow | Read input register values |
| 05 | Write Single Coil | DeviceAddr, RegisterHigh, RegisterLow, Status (Boolean) | Write single coil ON/OFF |
| 06 | Write Single Register | DeviceAddr, RegisterHigh, RegisterLow, ValueHigh, ValueLow | Write single holding register |
| 0F | Write Multiple Coils | DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow, Coil0~Coil7 (Boolean) | Write up to 8 coils |
| 10 | Write Multiple Registers | DeviceAddr, RegisterHigh, RegisterLow, QuantityHigh, QuantityLow, DataHigh, DataLow | Write same value to multiple registers |
| - | Send Raw | HexString | Send raw hex bytes with auto CRC |

All address/value parameters are byte-level (0-255) for direct hex input.

## Serial Settings

Configure in Chataigne's Serial panel: Port, BaudRate, DataBits, StopBits, Parity. Default: 9600 8N1.

## Template Notes

First parameter (DeviceAddr) in Templates may require manually unchecking "Editable" then re-checking it to pass values correctly (Chataigne UI quirk).
