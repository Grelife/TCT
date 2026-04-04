# TPM 安全文件保险箱 — 技术架构

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (Application)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 02_度量  │ │ 03_密封  │ │ 04_证明  │ │ 05_PKCS  │   │
│  │ PCR Ext  │ │ Seal/    │ │ Quote/   │ │ #11 Sig  │   │
│  │          │ │ Unseal   │ │ Verify   │ │ /Verify  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │             │            │             │         │
├───────┴─────────────┴────────────┴─────────────┴─────────┤
│                  工具层 (tpm2-tools)                       │
│  tpm2_pcrextend, tpm2_create, tpm2_quote, pkcs11-tool    │
├──────────────────────────────────────────────────────────┤
│     中间件层 (tpm2-tss / tpm2-pkcs11)                     │
│  ESAPI / FAPI / PKCS#11 Provider                         │
├──────────────────────────────────────────────────────────┤
│              TCTI 传输层 (mssim)                          │
│           TCP localhost:2321                               │
├──────────────────────────────────────────────────────────┤
│            TPM 模拟器 (swtpm)                             │
│           TPM 2.0 完整功能模拟                             │
└──────────────────────────────────────────────────────────┘
```

## 密钥层级结构

```
TPM 2.0 密钥层级 (Key Hierarchy)

├── Platform Hierarchy (平台层级)
│   └── 由平台固件管理
│
├── Endorsement Hierarchy (背书层级)
│   ├── EK (Endorsement Key) — TPM 身份标识
│   └── AK (Attestation Key) — 用于远程证明签名
│
├── Owner Hierarchy (所有者层级)
│   ├── Primary Key — 主密钥 (派生子密钥)
│   │   └── Sealed Object — 密封的数据对象
│   └── PKCS#11 Keys — 通过 PKCS#11 管理的密钥
│
└── Null Hierarchy (临时层级)
    └── 用于临时操作
```

## PCR 分配

| PCR 索引 | 用途 | 本项目使用 |
|---------|------|-----------|
| PCR 0 | BIOS/固件代码 | ✅ 模拟 Bootloader 度量 |
| PCR 1 | BIOS/固件配置 | ✅ 模拟 Kernel 度量 |
| PCR 2 | 可选 ROM | ✅ 模拟配置度量 |
| PCR 7 | Secure Boot 状态 | — |
| PCR 10 | IMA (完整性度量架构) | ✅ 单独度量演示 |
| PCR 16 | 调试/用户自定义 | ✅ 密封绑定 |

## 数据流

### 密封/解封流程
```
密封:
  secret.txt → tpm2_create(PCR策略) → seal.pub + seal.priv (TPM 保护)

解封 (成功):
  PCR 当前值 == 策略值 → tpm2_unseal → secret.txt ✅

解封 (失败):
  PCR 当前值 != 策略值 → tpm2_unseal → 拒绝 ❌
```

### 远程证明流程
```
验证方                        平台方
  │                            │
  │──── Nonce ────────────────▶│
  │                            │ TPM: Sign(PCR + Nonce, AK)
  │◀─── Quote + Signature ────│
  │                            │
  │ Verify(Quote, AK_pub)     │
  │ Check Nonce                │
  │ Compare PCR baseline       │
  ✅ / ❌                       │
```
