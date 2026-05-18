# ToCenTek Modbus RTU

Chataigne 自定义模块，通过串口实现 Modbus RTU 主站通信。

## 命令说明 / Commands

| 功能码 | 命令名称 | 参数 | 说明 |
|--------|---------|------|------|
| 01 | 读取线圈 / Read Coils | DeviceAddr, RegisterHigh/Low, QuantityHigh/Low | 读取线圈状态 |
| 02 | 读取离散输入 / Read Discrete Inputs | DeviceAddr, RegisterHigh/Low, QuantityHigh/Low | 读取离散输入状态 |
| 03 | 读取保持寄存器 / Read Holding Registers | DeviceAddr, RegisterHigh/Low, QuantityHigh/Low | 读取保持寄存器值 |
| 04 | 读取输入寄存器 / Read Input Registers | DeviceAddr, RegisterHigh/Low, QuantityHigh/Low | 读取输入寄存器值 |
| 05 | 写入单个线圈 / Write Single Coil | DeviceAddr, RegisterHigh/Low, Status | 写入单路线圈 ON/OFF |
| 06 | 写入单个寄存器 / Write Single Register | DeviceAddr, RegisterHigh/Low, ValueHigh/Low | 写入单个保持寄存器 |
| 0F | 写入多个线圈 / Write Multiple Coils | DeviceAddr, RegisterHigh/Low, QuantityHigh/Low, Coil0~Coil7 | 批量写入最多 8 路线圈 |
| 10 | 写入多个寄存器 / Write Multiple Registers | DeviceAddr, RegisterHigh/Low, QuantityHigh/Low, DataHigh/Low | 批量写入保持寄存器（相同值） |
| — | 发送原始数据 / Send Raw | HexString | 发送原始十六进制字节（自动添加 CRC） |

所有地址/数值参数均为字节级（0~255），支持直接十六进制输入。

## 串口设置 / Serial Settings

在 Chataigne 的 Serial 面板中配置：端口、波特率、数据位、停止位、校验位。默认：9600 8N1。

## 模板注意事项 / Template Notes

第一个参数（DeviceAddr）在 Templates 中可能需要手动取消勾选"Editable"再重新勾选，才能正确传递参数值（Chataigne UI 已知问题）。

## 开源协议 / License

MIT License
