# TPM 安全文件保险箱 — 可信计算技术课程设计

## 项目简介

本项目基于 **TPM 2.0 软件模拟器 (swtpm)** 和 **tpm2-tools** 工具链，完整演示 TPM 的四大核心功能：

| 功能 | 说明 | 对应脚本 |
|-----|------|---------|
| 🔍 **度量 (Measurement)** | PCR 扩展与完整性度量 | `02_measurement.sh` |
| 🔒 **密封存储 (Sealing)** | 数据绑定到平台状态 | `03_seal_unseal.sh` |
| 📋 **远程证明 (Attestation)** | 不可伪造的平台状态报告 | `04_attestation.sh` |
| 🔑 **PKCS#11 接口** | TPM 作为标准密码令牌 | `05_pkcs11.sh` |

## 环境要求

- **操作系统**: Ubuntu 22.04 LTS
- **权限**: 需要 sudo 权限（安装软件包）

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/Grelife/TCT.git
cd TCT

# 2. 安装依赖（只需运行一次）
chmod +x scripts/*.sh scripts/utils/*.sh
sudo bash scripts/00_env_setup.sh

# 3. 启动 TPM 模拟器
bash scripts/01_start_tpm.sh

# 4. 运行单项演示
bash scripts/02_measurement.sh      # 度量演示
bash scripts/03_seal_unseal.sh      # 密封/解封演示
bash scripts/04_attestation.sh      # 远程证明演示
bash scripts/05_pkcs11.sh           # PKCS#11 演示

# 5. 运行完整演示（串联所有功能）
bash scripts/06_full_demo.sh

# 6. 清理环境
bash scripts/99_cleanup.sh
```

## 代码安装与使用步骤

下面是一套完整的安装、运行与清理命令，可直接按顺序执行：

```bash
git clone https://github.com/Grelife/TCT.git
cd TCT
chmod +x scripts/*.sh scripts/utils/*.sh
sudo bash scripts/00_env_setup.sh
bash scripts/01_start_tpm.sh
bash scripts/02_measurement.sh
bash scripts/03_seal_unseal.sh
bash scripts/04_attestation.sh
bash scripts/05_pkcs11.sh
bash scripts/06_full_demo.sh
bash scripts/99_cleanup.sh
```

说明：

- `00_env_setup.sh`：安装 TPM 2.0 模拟器、工具链、PKCS#11 相关依赖。
- `01_start_tpm.sh`：启动 `swtpm` 模拟器并验证 TPM 连接。
- `02_measurement.sh`：演示 PCR 度量与篡改检测。
- `03_seal_unseal.sh`：演示基于 PCR 状态的密封与解封。
- `04_attestation.sh`：演示基于 EK/AK 的远程证明。
- `05_pkcs11.sh`：演示 TPM 作为 PKCS#11 密码令牌的签名与验签。
- `06_full_demo.sh`：串联完整“TPM 安全文件保险箱”业务流程。
- `99_cleanup.sh`：停止模拟器并删除临时状态文件。

## 项目结构

```
TCT/
├── README.md                       # 本文件
├── config/
│   └── tpm_env.conf                # TPM 环境变量配置
├── scripts/
│   ├── 00_env_setup.sh             # 环境安装
│   ├── 01_start_tpm.sh             # 启动 TPM 模拟器
│   ├── 02_measurement.sh           # 演示: PCR 度量
│   ├── 03_seal_unseal.sh           # 演示: 密封与解封
│   ├── 04_attestation.sh           # 演示: 远程证明
│   ├── 05_pkcs11.sh                # 演示: PKCS#11 接口
│   ├── 06_full_demo.sh             # 完整串联演示
│   ├── 99_cleanup.sh               # 清理环境
│   └── utils/
│       ├── colors.sh               # 彩色输出工具
│       └── tpm_helpers.sh          # TPM 操作辅助函数
├── test_files/
│   ├── secret.txt                  # 测试用秘密文件
│   └── config_baseline.txt         # 测试用配置基线
└── docs/
    ├── architecture.md             # 技术架构说明
    └── screenshots/                # 运行截图
```

## 技术栈

| 组件 | 用途 |
|-----|------|
| **swtpm** | TPM 2.0 软件模拟器 |
| **tpm2-tss** | TPM2 软件栈底层库 |
| **tpm2-tools** | TPM2 命令行工具集 |
| **tpm2-pkcs11** | PKCS#11 接口模块 |
| **OpenSSL** | 密码学工具 |
| **OpenSC** | PKCS#11 工具 (pkcs11-tool) |

## 许可证

本项目仅用于课程学习目的。
