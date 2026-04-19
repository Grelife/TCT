# TPM 安全文件保险箱课程设计报告

## 1. 项目概述

### 1.1 课题名称

TPM 安全文件保险箱

### 1.2 项目简介

本项目基于 TPM 2.0 软件模拟器 `swtpm`、TPM 软件栈 `tpm2-tss`、命令行工具 `tpm2-tools` 以及 `tpm2-pkcs11`，设计并实现了一个教学型可信计算实验平台。项目覆盖了 TPM 的四项典型能力：

- PCR 度量（Measurement）
- 数据密封与解封（Seal / Unseal）
- 远程证明（Remote Attestation）
- PKCS#11 密码令牌接口

项目的总体入口与说明见 [README.md](../README.md)，统一配置位于 [config/tpm_env.conf](../config/tpm_env.conf)。

### 1.3 实验目标

- 搭建 TPM 2.0 软件实验环境，掌握 `swtpm` 与 `tpm2-tools` 的基本用法。
- 理解 PCR 的累积度量机制，验证“不可回退、不可伪造、可重复验证”的特性。
- 实现基于 PCR 状态的数据密封与解封，证明“数据与平台状态绑定”。
- 实现基于 EK / AK / Quote / Nonce 的远程证明流程。
- 将 TPM 通过 PKCS#11 暴露为标准密码令牌，实现密钥生成、签名与验签。
- 串联形成一个“TPM 安全文件保险箱”的完整演示场景。

## 2. 实验拓扑

### 2.1 总体拓扑

```text
实验 1-3
Bash 脚本
  -> tpm2-tools
  -> TCTI: swtpm:host=localhost,port=2321
  -> swtpm TPM 2.0 模拟器

实验 4
Bash 脚本
  -> tpm2_ptool / pkcs11-tool / openssl
  -> TCTI: tabrmd:bus_type=session
  -> tpm2-abrmd 资源管理器
  -> swtpm TPM 2.0 模拟器
```

### 2.2 实验组件说明

- `swtpm`：软件 TPM 2.0 模拟器，用于在没有真实 TPM 芯片的环境下完成完整实验。
- `tpm2-tools`：提供 `tpm2_pcrread`、`tpm2_pcrextend`、`tpm2_createprimary`、`tpm2_quote` 等命令。
- `tpm2-abrmd`：TPM 资源管理器，在 PKCS#11 场景中负责上下文调度。
- `tpm2_ptool`：管理 TPM PKCS#11 token 和 key。
- `pkcs11-tool`：以标准 PKCS#11 方式访问 token。
- `openssl`：用于生成随机数、转换公钥格式和验证签名。

### 2.3 项目脚本划分

- [scripts/00_env_setup.sh](../scripts/00_env_setup.sh)：环境安装
- [scripts/01_start_tpm.sh](../scripts/01_start_tpm.sh)：启动模拟器
- [scripts/02_measurement.sh](../scripts/02_measurement.sh)：PCR 度量
- [scripts/03_seal_unseal.sh](../scripts/03_seal_unseal.sh)：密封与解封
- [scripts/04_attestation.sh](../scripts/04_attestation.sh)：远程证明
- [scripts/05_pkcs11.sh](../scripts/05_pkcs11.sh)：PKCS#11 演示
- [scripts/06_full_demo.sh](../scripts/06_full_demo.sh)：完整演示
- [scripts/99_cleanup.sh](../scripts/99_cleanup.sh)：环境清理

## 3. 原理及关键技术

### 3.1 PCR 度量原理

PCR（Platform Configuration Register）是 TPM 中用于记录平台状态的寄存器。其更新方式不是覆盖写入，而是执行 Extend：

```text
PCR_new = SHA256(PCR_old || new_data)
```

这意味着：

- 每次写入都会保留历史信息，形成度量链。
- 旧值无法直接恢复，因此具备不可回退性。
- 相同的输入序列总能得到相同的结果，因此可用于远程校验。

核心实现见 [scripts/02_measurement.sh](../scripts/02_measurement.sh)。

### 3.2 数据密封原理

数据密封是将秘密数据与某一组 PCR 状态绑定。TPM 内部保存的是“只有当 PCR 满足某个策略时才允许解封”的对象。

本项目中：

- 先对配置文件做度量，建立 PCR 16 基线。
- 再根据当前 PCR 16 生成策略文件。
- 最后把秘密数据和该策略绑定，生成密封对象。

解封时只有当前 PCR 值与密封时记录的一致，TPM 才允许返回原始秘密。

核心实现见 [scripts/03_seal_unseal.sh](../scripts/03_seal_unseal.sh)。

### 3.3 远程证明原理

远程证明的本质是“平台方向验证方提交一份 TPM 签名的平台状态报告”。

本实验流程为：

1. 验证方生成随机 `Nonce`。
2. 平台方用 AK（Attestation Key）对 PCR 值和 Nonce 生成 Quote。
3. 验证方用 AK 公钥验证签名，并检查 Nonce 是否匹配。

这样可以同时获得：

- 平台状态真实性：签名来自 TPM 内部 AK 私钥。
- 数据新鲜性：Quote 绑定本次 Nonce，可防止重放攻击。

核心实现见 [scripts/04_attestation.sh](../scripts/04_attestation.sh)。

### 3.4 PKCS#11 关键技术

PKCS#11 是标准化密码令牌接口。通过 `tpm2-pkcs11`，TPM 可以像智能卡一样被标准应用调用。

本实验中采用：

- `tpm2_ptool` 创建 token 和 RSA 密钥对。
- `pkcs11-tool` 列出对象、完成签名、导出公钥。
- `openssl` 验证签名结果。

由于 `tpm2_ptool` 在一条命令内部会连续发起多次 TPM 操作，容易耗尽 TPM 的瞬态对象插槽，所以必须通过 `tpm2-abrmd` 资源管理器访问 TPM。该逻辑见 [scripts/05_pkcs11.sh](../scripts/05_pkcs11.sh)。

### 3.5 关键辅助函数

公共函数位于 [scripts/utils/tpm_helpers.sh](../scripts/utils/tpm_helpers.sh)。

关键函数包括：

- `check_environment()`：检查工具安装、模拟器运行状态与 TPM 连通性。
- `setup_work_dir()`：为不同实验创建独立工作目录。
- `flush_all_contexts()`：清除所有 TPM 上下文，缓解对象槽位不足问题。
- `compute_sha256()`：计算文件哈希。

## 4. 代码安装与使用步骤

### 4.1 环境要求

- 操作系统：Ubuntu 22.04 LTS
- 权限：需要 `sudo`
- 网络：需要能访问 Ubuntu 软件源

### 4.2 安装与运行命令

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

### 4.3 每个脚本的用途

- `00_env_setup.sh`：安装 TPM 相关软件。
- `01_start_tpm.sh`：启动 `swtpm` 并验证连接。
- `02_measurement.sh`：执行 PCR 度量实验。
- `03_seal_unseal.sh`：执行密封/解封实验。
- `04_attestation.sh`：执行远程证明实验。
- `05_pkcs11.sh`：执行 PKCS#11 实验。
- `06_full_demo.sh`：执行完整业务流程演示。
- `99_cleanup.sh`：停止模拟器并清理临时文件。

### 4.4 使用注意事项

- `99_cleanup.sh` 会停止 `swtpm` 并删除工作目录，清理之后如果要重新实验，必须再次运行 `bash scripts/01_start_tpm.sh`。
- PKCS#11 实验由脚本自动进入私有 D-Bus 会话，不需要手工先运行 `dbus-run-session bash`。

## 5. 实验过程与命令详解

本节以 `实验过程.txt` 中的真实执行输出为依据，对每一步命令、参数及返回结果进行说明。

### 5.1 环境安装实验

#### 命令 1

```bash
sudo bash scripts/00_env_setup.sh
```

含义：

- 以 root 权限执行环境安装脚本。
- 该脚本逻辑位于 [scripts/00_env_setup.sh](../scripts/00_env_setup.sh)。

#### 命令 2

```bash
apt-get update
```

含义：

- 更新软件包索引。
- 确保后续安装到的是仓库中的最新可用版本。

返回结果说明：

- `包索引已更新` 表示软件源可访问、索引刷新成功。

#### 命令 3

```bash
apt-get install -y swtpm swtpm-tools tpm2-tools libtss2-dev ...
```

含义：

- 安装 TPM 模拟器、TPM 工具链、资源管理器、PKCS#11 模块及辅助工具。

关键软件包用途：

- `swtpm`：TPM 模拟器
- `tpm2-tools`：TPM 命令行工具
- `tpm2-abrmd`：资源管理器
- `libtpm2-pkcs11-1` / `libtpm2-pkcs11-tools`：PKCS#11 支持
- `opensc`：提供 `pkcs11-tool`
- `openssl`：签名验证和随机数生成

返回结果说明：

- `已安装，跳过`：系统中已存在该软件包。
- `安装成功`：当前命令新安装了该软件包。
- `安装失败（可能在此版本不可用，继续...）`：脚本容错后继续执行。

#### 命令 4

```bash
swtpm --version
tpm2_pcrread --version
tpm2_createprimary --version
tpm2_quote --version
pkcs11-tool --version
```

含义：

- 验证关键命令是否已安装并可执行。

返回结果说明：

- `tool="tpm2_pcrread" version="5.2"`：工具版本号及支持的 TCTI 加载器。
- `TPM emulator version 0.6.3`：模拟器版本号。

### 5.2 启动 TPM 模拟器实验

#### 命令 1

```bash
bash scripts/01_start_tpm.sh
```

含义：

- 启动 TPM 2.0 模拟器，并在后台持续运行。

#### 命令 2

```bash
swtpm socket \
  --tpmstate dir=/tmp/tpm-vault-state \
  --tpm2 \
  --ctrl type=tcp,port=2322 \
  --server type=tcp,port=2321 \
  --flags not-need-init,startup-clear
```

参数说明：

- `--tpmstate dir=...`：TPM 持久状态目录。
- `--tpm2`：启用 TPM 2.0 模式。
- `--ctrl type=tcp,port=2322`：控制通道端口。
- `--server type=tcp,port=2321`：命令通道端口。
- `--flags not-need-init,startup-clear`：不需要额外初始化，并在启动时执行清除式启动。

返回结果说明：

- `swtpm 已启动 (PID: 24707)`：说明模拟器进程已成功启动。
- `服务端口: 2321`：TPM 命令收发端口。
- `控制端口: 2322`：模拟器控制端口。

#### 命令 3

```bash
tpm2_startup -c
```

含义：

- 执行 `TPM2_Startup(CLEAR)`，使 TPM 进入干净状态。

返回结果说明：

- `TPM2_Startup(CLEAR) 成功`：启动命令由工具主动执行成功。
- 若脚本显示“已由 swtpm 自动完成”，说明模拟器已经自动做过这一步。

#### 命令 4

```bash
tpm2_pcrread sha256:0
```

含义：

- 读取 SHA-256 PCR bank 中的 PCR 0。

返回结果说明：

- `sha256:`：表示读取的是 SHA-256 哈希算法对应的 PCR bank。
- `0 : 0x000...000`：PCR 0 当前值，初始为全零。

### 5.3 PCR 度量实验

实验脚本见 [scripts/02_measurement.sh](../scripts/02_measurement.sh)。

#### 步骤 1：读取初始 PCR 值

```bash
tpm2_pcrread sha256:10
```

含义：

- 读取 PCR 10 当前值。
- PCR 10 常用于应用层或 IMA 相关度量。

返回结果说明：

- `10: 0x000...000`：说明 PCR 10 还未写入任何度量值。

#### 步骤 2：计算配置文件哈希

```bash
sha256sum config.txt
```

含义：

- 计算配置文件内容的 SHA-256 摘要。

返回结果说明：

- 返回的 `1c3b9464...29f41a7` 是配置文件内容的唯一摘要表示。

#### 步骤 3：写入 PCR 10

```bash
tpm2_pcrextend 10:sha256=<hash>
```

参数说明：

- `10`：目标 PCR 编号。
- `sha256`：目标 bank。
- `<hash>`：本次扩展写入的摘要值。

返回结果说明：

- 该命令成功时通常无详细文本输出。
- 之后再次读取 PCR 10，得到新值 `0x85CCFB...`，说明度量已被记录。

#### 步骤 4：模拟文件被篡改

```bash
sed -i 's/ssh_port=22/ssh_port=2222/' config.txt
sha256sum config.txt
```

含义：

- 修改配置文件中的关键参数，再计算其新哈希。

返回结果说明：

- 原哈希和新哈希不同，表示文件完整性已发生变化。

#### 步骤 5：再次扩展 PCR

```bash
tpm2_pcrextend 10:sha256=<tampered_hash>
```

返回结果说明：

- 第二次读取 PCR 10 时得到 `0x2CD101...`，与第一次扩展值不同。
- 这说明 PCR 不会覆盖旧值，而是形成新的链式摘要。

#### 结果分析

- 初始值：全零
- 第一次度量后：记录可信基线
- 第二次度量后：篡改被反映到 PCR 中

结论：PCR 可作为平台完整性状态的可信摘要。

### 5.4 密封与解封实验

实验脚本见 [scripts/03_seal_unseal.sh](../scripts/03_seal_unseal.sh)。

#### 步骤 1：建立 PCR16 基线

```bash
tpm2_pcrextend 16:sha256=<config_hash>
```

含义：

- 把配置文件哈希扩展到 PCR16。
- PCR16 在本项目中用于自定义安全策略绑定。

返回结果说明：

- 脚本输出 `PCR[16] 基线值: 16:0x85CCFB...`，表示当前可信状态已经建立。

#### 步骤 2：创建主密钥

```bash
tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx
```

参数说明：

- `-C o`：Owner hierarchy
- `-g sha256`：名称和相关摘要算法
- `-G rsa`：生成 RSA 主密钥
- `-c primary.ctx`：保存对象上下文

返回字段说明：

- `name-alg`：对象名称使用的摘要算法。
- `attributes`：对象属性集合，如 `fixedtpm`、`fixedparent`、`restricted`、`decrypt`。
- `type`：对象类型，这里为 `rsa`。
- `exponent`：RSA 公钥指数，通常为 `65537`。
- `bits`：RSA 密钥长度，本实验为 `2048`。
- `scheme`：密钥方案，此处为 `null`，表示本对象用于父对象场景。
- `sym-alg` / `sym-mode` / `sym-keybits`：对象保护使用的对称算法参数。
- `rsa`：生成的公钥模数。

#### 步骤 3：创建 PCR 授权策略

```bash
tpm2_pcrread -o pcr_current.bin sha256:16
tpm2_startauthsession -S session.ctx
tpm2_policypcr -S session.ctx -l sha256:16 -f pcr_current.bin -L pcr.policy
tpm2_flushcontext session.ctx
```

含义：

- 读取当前 PCR16 值并写入文件。
- 创建授权会话。
- 基于 PCR16 当前值计算策略摘要。
- 保存策略到 `pcr.policy`。

返回结果说明：

- `48ca68...`：策略摘要，即当前策略会话最终计算出的 digest。
- `策略哈希: a6b2ce...`：策略文件本身的 SHA-256 哈希，便于脚本展示。

#### 步骤 4：密封秘密

```bash
tpm2_create -C primary.ctx -L pcr.policy -i secret.txt -u seal.pub -r seal.priv
```

参数说明：

- `-C primary.ctx`：父对象是主密钥。
- `-L pcr.policy`：绑定 PCR 策略。
- `-i secret.txt`：要密封的输入数据。
- `-u seal.pub`：密封对象公有部分。
- `-r seal.priv`：密封对象私有部分。

返回字段说明：

- `type: keyedhash`：该对象是密封类对象。
- `algorithm: null`：对象本身不作为对称加密算法对象使用。
- `keyedhash`：对象相关摘要。
- `authorization policy`：此对象所绑定的 PCR 策略摘要。

随后执行：

```bash
tpm2_load -C primary.ctx -u seal.pub -r seal.priv -c seal.ctx
```

返回结果说明：

- `name: 000b...`：被加载对象的名称，后续解封使用 `seal.ctx` 引用该对象。

#### 步骤 5：正常状态下解封

```bash
tpm2_startauthsession -S session.ctx --policy-session
tpm2_policypcr -S session.ctx -l sha256:16
tpm2_unseal -c seal.ctx -p session:session.ctx
```

含义：

- 开启策略会话。
- 证明当前 PCR16 满足策略。
- 请求解封。

返回结果说明：

- `MySecretKey-123456`：秘密数据成功恢复。
- 表明平台状态与密封时一致。

#### 步骤 6：篡改后再解封

```bash
tpm2_pcrextend 16:sha256=<tamper_hash>
tpm2_startauthsession -S session.ctx --policy-session
tpm2_policypcr -S session.ctx -l sha256:16
tpm2_unseal -c seal.ctx -p session:session.ctx
```

返回结果说明：

- PCR16 已发生变化。
- `tpm2_unseal` 返回失败。
- 日志显示 `TPM 拒绝释放数据`，说明策略不匹配。

结论：密封对象与平台状态绑定成功。

### 5.5 远程证明实验

实验脚本见 [scripts/04_attestation.sh](../scripts/04_attestation.sh)。

#### 步骤 1：建立证明用 PCR 状态

```bash
tpm2_pcrextend 0:sha256=<boot_hash>
tpm2_pcrextend 1:sha256=<kernel_hash>
tpm2_pcrextend 2:sha256=<config_hash>
```

含义：

- 模拟系统启动链中 Bootloader、Kernel、配置文件的完整性度量。

返回结果说明：

- PCR0、PCR1、PCR2 分别出现不同哈希值，表示三部分状态已被记录。

#### 步骤 2：创建 EK

```bash
tpm2_createek -c ek.ctx -G rsa -u ek.pub
```

含义：

- 创建背书密钥 EK，作为 TPM 身份根。

返回结果说明：

- 日志中无复杂结构，仅显示成功创建。

#### 步骤 3：创建 AK

```bash
tpm2_createak -C ek.ctx -c ak.ctx -G rsa -g sha256 -s rsassa -u ak.pub -n ak.name
```

参数说明：

- `-C ek.ctx`：AK 依附于 EK 层级。
- `-G rsa`：RSA 密钥。
- `-g sha256`：摘要算法。
- `-s rsassa`：签名方案。

返回字段说明：

- `loaded-key.name`：AK 名称。
- `qualified name`：AK 的限定名称。

然后执行：

```bash
tpm2_readpublic -c ak.ctx -f pem -o ak.pem
```

返回字段说明：

- `attributes`：包含 `sign`，说明 AK 用于签名。
- `scheme: rsassa`：签名算法。
- `rsa`：公钥模数。
- `-----BEGIN PUBLIC KEY-----`：导出的 PEM 格式 AK 公钥。

#### 步骤 4：生成 Nonce

```bash
NONCE=$(openssl rand -hex 16)
```

返回结果说明：

- 例如 `0x4a71979d3988cba9dcfd9dc55c5253f6`。
- 长度为 16 字节，作为本次挑战的随机数。

#### 步骤 5：生成 Quote

```bash
tpm2_quote -c ak.ctx -l sha256:0,1,2 -q <nonce> -m quote.msg -s quote.sig -o quote_pcr.bin -g sha256
```

参数说明：

- `-c ak.ctx`：用 AK 私钥签名。
- `-l sha256:0,1,2`：引用 PCR0、1、2。
- `-q <nonce>`：绑定本次挑战。
- `-m quote.msg`：输出 Quote 消息体。
- `-s quote.sig`：输出签名。
- `-o quote_pcr.bin`：输出 PCR 列表。
- `-g sha256`：摘要算法。

返回字段说明：

- `quoted`：被签名的原始 Quote 结构。
- `signature.alg`：签名算法。
- `sig`：签名结果。
- `pcrs`：PCR 值列表。
- `calcDigest`：PCR 值计算得到的摘要。

#### 步骤 6：验证 Quote

```bash
tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q <nonce>
```

含义：

- 用 AK 公钥验证 Quote 的真实性，并同时检查 Nonce 是否一致。

返回结果说明：

- 若成功，输出 `pcrs` 和 `sig` 内容。
- 实验中显示：
  - 签名有效
  - Nonce 匹配
  - PCR 可信

#### 步骤 7：错误 Nonce 验证

```bash
tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q <wrong_nonce>
```

返回结果说明：

- 实验中输出 `验证失败！Nonce 不匹配`。
- 说明旧 Quote 无法被重放利用。

### 5.6 PKCS#11 实验

实验脚本见 [scripts/05_pkcs11.sh](../scripts/05_pkcs11.sh)。

#### 步骤 0：启动资源管理器并切换 TCTI

```bash
tpm2-abrmd --tcti="swtpm:host=localhost,port=2321" --session &
export TPM2TOOLS_TCTI="tabrmd:bus_type=session"
export TPM2_PKCS11_TCTI="tabrmd:bus_type=session"
```

含义：

- 用 `abrmd` 代理所有 PKCS#11 访问。
- 切换 TCTI 到资源管理器。

返回结果说明：

- `tcti_conf after: "swtpm:host=localhost,port=2321"`：abrmd 后端接的是 swtpm。
- `资源管理器已启动`：abrmd 可用。

#### 步骤 1：初始化 Token Store

```bash
tpm2_ptool init
```

返回字段说明：

- `action: Created`：创建动作成功。
- `id: 1`：新建 store 的 ID。

#### 步骤 2：创建 Token

```bash
tpm2_ptool addtoken --pid=1 --label=tpm-vault-token --sopin=sopin123456 --userpin=userpin123456
```

参数说明：

- `--pid=1`：父 store ID。
- `--label`：token 标签。
- `--sopin`：Security Officer PIN。
- `--userpin`：普通用户 PIN。

#### 步骤 3：创建 RSA 密钥

```bash
tpm2_ptool addkey --label=tpm-vault-token --userpin=userpin123456 --algorithm=rsa2048
```

返回字段说明：

- `action: add`：新增密钥对象。
- `private.CKA_ID`：私钥对象 ID。
- `public.CKA_ID`：公钥对象 ID。

本项目后续导出公钥时会依据该 `CKA_ID` 精确读取，见 [scripts/05_pkcs11.sh](../scripts/05_pkcs11.sh)。

#### 步骤 4：查看 Slot 和对象

```bash
pkcs11-tool --module /usr/lib/x86_64-linux-gnu/pkcs11/libtpm2_pkcs11.so -L
pkcs11-tool --module /usr/lib/x86_64-linux-gnu/pkcs11/libtpm2_pkcs11.so -O --login --pin userpin123456
```

返回字段说明：

- `Slot 0 (0x1)`：当前可用的 token 槽位。
- `token label`：token 标签。
- `token manufacturer` / `token model`：令牌设备信息。
- `token flags`：是否要求登录、是否已初始化等。
- `Private Key Object`：私钥对象。
- `Usage: decrypt, sign`：私钥用途。
- `Access: never extractable`：私钥不能被导出。
- `Public Key Object`：对应公钥对象。

#### 步骤 5：签名

```bash
pkcs11-tool --module /usr/lib/x86_64-linux-gnu/pkcs11/libtpm2_pkcs11.so \
  --sign --mechanism SHA256-RSA-PKCS --login --pin userpin123456 \
  -i data_to_sign.txt -o signature.bin
```

含义：

- 用 TPM 内私钥对待签名文件执行 RSA-SHA256 签名。

返回结果说明：

- `签名成功！(256 字节)`：说明生成了 RSA-2048 签名。

#### 步骤 6：导出公钥并验签

```bash
pkcs11-tool --module /usr/lib/x86_64-linux-gnu/pkcs11/libtpm2_pkcs11.so \
  --read-object --type pubkey --login --pin userpin123456 --id <CKA_ID> -o pubkey.der
openssl pkey -pubin -inform DER -in pubkey.der -out pubkey.pem
openssl dgst -sha256 -verify pubkey.pem -signature signature.bin data_to_sign.txt
```

返回结果说明：

- `Using slot 0 with a present token (0x1)`：说明找到了活动 token。
- `公钥已导出`：DER 格式公钥导出成功。
- `Verified OK`：验签成功，说明导出公钥与签名确实来自同一密钥对。

### 5.7 完整演示实验

完整脚本见 [scripts/06_full_demo.sh](../scripts/06_full_demo.sh)。

该脚本按“度量 -> 密封 -> 远程证明 -> 解封 -> 攻击模拟 -> 防御成功”的业务顺序执行，适合作为最终效果展示。

实验输出表明：

- 平台可信时，保险箱成功解封，得到 `MyVaultSecret-1234`。
- 篡改 PCR16 后，解封被 TPM 拒绝。

### 5.8 清理实验

脚本见 [scripts/99_cleanup.sh](../scripts/99_cleanup.sh)。

执行：

```bash
bash scripts/99_cleanup.sh
```

效果：

- 停止 `swtpm`
- 删除 `/tmp/tpm-vault-state`
- 删除 `/tmp/tpm-vault-workdir`

在实验记录中，清理后再次直接运行 `bash scripts/06_full_demo.sh`，脚本提示 `TPM 模拟器 (swtpm) 未在运行！`，证明环境检查逻辑正确生效。

## 6. 关键代码分析

### 6.1 统一配置文件

[config/tpm_env.conf](../config/tpm_env.conf) 中集中定义了：

- TPM 端口
- TPM 状态目录
- TCTI 类型
- PKCS#11 token 配置
- 工作目录

这使不同脚本共享相同的运行环境，降低了维护复杂度。

### 6.2 环境检查与公共函数

[scripts/utils/tpm_helpers.sh](../scripts/utils/tpm_helpers.sh) 中的 `check_environment()` 会在每个实验开始前检查：

- `tpm2-tools` 是否已安装
- `swtpm` 是否在运行
- TPM 是否能正常读取 PCR

`flush_all_contexts()` 位于 [tpm_helpers.sh](../scripts/utils/tpm_helpers.sh)，其作用是释放 TPM 上下文，避免内存占满。

### 6.3 PKCS#11 公钥导出修复

在 [scripts/05_pkcs11.sh](../scripts/05_pkcs11.sh) 中，脚本会解析 `tpm2_ptool addkey` 返回的 `CKA_ID`，再按 `--id` 精确导出公钥对象。

这一实现修复了“签名成功但无法稳定导出正确公钥”的问题，使验签步骤能够稳定成功。

## 7. 效果演示

根据本次真实实验记录，可以总结出以下效果：

- 环境安装成功，Ubuntu 22.04 下 TPM 工具链完整可用。
- TPM 模拟器启动成功，PCR 初始值为全零。
- PCR 度量实验成功，文件篡改后 PCR 结果显著变化。
- 数据密封实验成功，可信状态可解封，篡改后拒绝解封。
- 远程证明实验成功，Quote 验证通过，错误 Nonce 验证失败。
- PKCS#11 实验成功，完成 token 创建、密钥生成、签名、公钥导出、验签。
- 完整演示脚本成功展示“可信时可取密，篡改后被拒绝”的安全业务流程。

## 8. 安全分析

### 8.1 安全收益

- 完整性保护：PCR 记录关键组件的度量值，可用于检测平台篡改。
- 机密数据保护：秘密数据不是简单放在文件里，而是绑定到 TPM 与平台状态。
- 平台可信证明：远程方可通过 Quote 验证平台当前状态。
- 防重放攻击：Nonce 让旧 Quote 无法重复利用。
- 私钥保护：PKCS#11 私钥保存在 TPM 中，外部只能调用签名能力，不能直接导出私钥材料。

### 8.2 风险与局限

- 本实验基于 `swtpm` 软件模拟器，不具备真实硬件 TPM 的物理防拆能力。
- EK 信任链在实验中被简化，真实生产环境还需要验证厂商 EK 证书。
- PKCS#11 的 SO PIN / User PIN 为固定演示值，生产环境必须改为强口令并妥善管理。
- 资源管理器是 PKCS#11 成功运行的关键前提，若缺失 `abrmd`，高级 TPM 操作容易失败。

## 9. 总结

本课程设计成功构建了一个完整的 TPM 2.0 教学实验平台，并通过实际运行验证了：

- PCR 度量可作为平台状态的可信摘要。
- TPM 密封机制可把机密数据绑定到可信平台状态。
- 远程证明可让验证方远程确认平台状态且防止重放攻击。
- TPM 通过 PKCS#11 接口可被标准密码学工具直接使用。

从教学价值看，本项目不仅展示了 TPM 的理论机制，还通过脚本化实验把原理落到了具体命令、具体输出和具体安全效果上，具备较强的可复现实验价值和课程设计展示价值。
