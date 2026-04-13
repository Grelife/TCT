# TPM 安全文件保险箱 — 动手实验指导书

> **学习方式**: 每一步你都手动输入命令，观察输出，理解原理。
> 不要复制粘贴整段代码，逐条执行、逐条理解。

---

## 实验零：环境准备

### 0.1 安装软件包

```bash
sudo apt update
sudo apt install -y swtpm swtpm-tools tpm2-tools libtss2-dev openssl
```

**你装了什么？**
| 软件包 | 它是什么 |
|--------|---------|
| `swtpm` | TPM 2.0 软件模拟器 —— 用软件模拟一块 TPM 芯片 |
| `tpm2-tools` | 命令行工具集 —— 让你能和 TPM 对话 |
| `libtss2-dev` | TPM2 软件栈的底层库 |
| `openssl` | 通用密码学工具 |

> 💡 **为什么用模拟器?**
> 真实的 TPM 是焊在主板上的芯片。我们用 `swtpm` 在软件层完整模拟它的行为，
> 所有命令和真实 TPM 完全一致，只是底层从硬件变成了软件。

### 0.2 启动 TPM 模拟器

先创建一个目录，用来存放 TPM 的"持久状态"（就像芯片里的闪存）：

```bash
mkdir -p /tmp/tpm-state
```

然后启动模拟器（这个命令会占住终端，**开一个新终端**继续后面的操作）：

```bash
swtpm socket \
    --tpmstate dir=/tmp/tpm-state \
    --tpm2 \
    --ctrl type=tcp,port=2322 \
    --server type=tcp,port=2321 \
    --flags not-need-init,startup-clear
```

**每个参数什么意思？**
| 参数 | 含义 |
|------|------|
| `--tpmstate dir=/tmp/tpm-state` | TPM 持久数据存在哪里 |
| `--tpm2` | 模拟的是 TPM 2.0（不是老的 1.2） |
| `--server type=tcp,port=2321` | TPM 命令通道，监听 2321 端口 |
| `--ctrl type=tcp,port=2322` | TPM 控制通道，监听 2322 端口 |
| `--flags startup-clear` | 启动时自动执行 TPM2_Startup(CLEAR) |

### 0.3 在新终端中配置环境变量

**每次打开新终端都要执行这一行**，告诉 tpm2-tools 怎么连到模拟器：

```bash
export TPM2TOOLS_TCTI="swtpm:host=localhost,port=2321"
```

> 💡 **TCTI 是什么?**
> TCTI = TPM Command Transmission Interface（命令传输接口）
> 它定义了 tpm2-tools 怎么把命令发给 TPM。
> `swtpm` 表示通过 TCP 连接到 swtpm 模拟器（专用 TCTI，兼容性最好）。

### 0.4 验证连接

```bash
tpm2_pcrread sha256:0
```

你应该看到类似这样的输出：
```
  sha256:
    0 : 0x0000000000000000000000000000000000000000000000000000000000000000
```

这就是 **PCR 0** 的初始值 —— 全零。说明连接成功！

---

## 实验一：PCR 度量 (Measurement)

### 核心概念

**PCR（Platform Configuration Register，平台配置寄存器）** 是 TPM 内部的一组特殊寄存器。

它的关键特性：**只能扩展，不能直接写入**。

扩展的数学公式：
```
PCR_new = SHA256(PCR_old || new_data)
```

也就是说，把旧值和新数据拼接起来，再做一次哈希。这意味着：
- 你无法把 PCR 设回之前的值（单向性）
- 每次扩展都"记住"了之前所有的度量（累积性）
- 相同的度量序列一定产生相同的结果（确定性）

### 1.1 查看所有 SHA-256 PCR 的当前值

```bash
tpm2_pcrread sha256
```

你会看到 PCR 0 ~ PCR 23 的值。注意观察：
- **PCR 0~16 和 23**：全零 (`0x000...`) — 表示"空白待填"，等待被度量数据扩展
- **PCR 17~22**：全 F (`0xFFF...`) — 这些是 **D-RTM（动态信任根）** 专用的 PCR

> 💡 **为什么 PCR 17~22 是全 F 而不是全零？**
> 全 F 表示"尚未执行 D-RTM 启动（如 Intel TXT）"。如果也初始化为全零，
> 攻击者可能在系统还没做 D-RTM 度量的窗口期，利用全零状态骗过绑定了这些 PCR 的策略。
> 全 F 是一个不可能通过正常度量产生的值，确保策略在 D-RTM 未执行时一定失败。
>
> 我们的实验只用 PCR 0~16，不涉及 D-RTM。

### 1.2 我们来度量一个文件

先看看我们要度量的文件内容：

```bash
cat test_files/config_baseline.txt
```

计算它的 SHA-256 哈希：

```bash
sha256sum test_files/config_baseline.txt
```

记下这个哈希值。然后手动把它扩展到 PCR 10：

```bash
# 把上面得到的哈希值替换掉 <hash>
tpm2_pcrextend 10:sha256=<hash>
```

> 💡 **为什么用 PCR 10?**
> Linux IMA（完整性度量架构）在真实系统中就用 PCR 10 记录应用层度量。
> PCR 0-7 通常由 BIOS/固件占用。PCR 16-23 是用户自定义的。

### 1.3 看看 PCR 变了没

```bash
tpm2_pcrread sha256:10
```

现在 PCR 10 不再是全零了！它变成了 `SHA256(全零 || 你的文件哈希)`。

### 1.4 再扩展一次，观察变化

随便扩展一个新值：

```bash
echo -n "hello-tpm" | sha256sum
# 记下哈希值，然后：
tpm2_pcrextend 10:sha256=<新的hash>
```

再读一次：

```bash
tpm2_pcrread sha256:10
```

**对比三个值**（自己记录下来）：
1. 初始值（全零）
2. 第一次扩展后
3. 第二次扩展后

每次都不一样，而且你**无法**把它设回第一次扩展后的值。这就是 PCR 的安全意义。

### 1.5 思考题

> ❓ 如果攻击者篡改了 config_baseline.txt 的内容，PCR 10 的值会一样吗？
> ❓ 如果攻击者知道目标 PCR 值，能否伪造一个文件来产生相同的 PCR 值？（提示：想想哈希碰撞的难度）

---

## 实验二：数据密封与解封 (Seal / Unseal)

### 核心概念

**密封（Seal）**: 把数据加密，并且绑定一个 PCR 条件："只有当 PCR 的值是 X 时，才允许解密"。

**解封（Unseal）**: 向 TPM 请求解密数据。TPM 会先检查当前的 PCR 值，匹配了才给你数据。

这就是 **"数据与平台状态绑定"** —— 只有系统处于可信状态时，才能拿到密钥/秘密。

### 2.1 准备工作 —— 重置 PCR 16

> PCR 16 是"可重置"的调试用 PCR，方便实验。

```bash
tpm2_pcrreset 16
tpm2_pcrread sha256:16
```

确认 PCR 16 回到全零。

### 2.2 建立"可信基线" —— 度量配置文件

```bash
CONFIG_HASH=$(sha256sum test_files/config_baseline.txt | awk '{print $1}')
echo "配置文件哈希: $CONFIG_HASH"
tpm2_pcrextend 16:sha256=$CONFIG_HASH
tpm2_pcrread sha256:16
```

现在 PCR 16 记录了"系统配置的度量值"。

### 2.3 创建主密钥（Primary Key）

TPM 的密钥是树形结构的。最顶层是"主密钥"，其他密钥从它派生。

```bash
tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx
```

| 参数 | 含义 |
|------|------|
| `-C o` | 在 Owner 层级下创建（`o`=owner, `e`=endorsement, `p`=platform） |
| `-g sha256` | 用 SHA-256 作为哈希算法 |
| `-G rsa` | 密钥类型是 RSA |
| `-c primary.ctx` | 把密钥上下文保存到这个文件 |

> 💡 **什么是 "上下文文件"(.ctx)?**
> TPM 内部的对象需要一个"句柄"来引用。上下文文件就是把这个句柄序列化到磁盘，
> 方便后续命令引用同一个对象。

### 2.4 创建 PCR 授权策略

这一步定义 "什么条件下才允许操作"：

```bash
# 把当前 PCR 16 的值读出来保存到文件
tpm2_pcrread -o pcr_values.bin sha256:16

# 开始一个策略计算会话
tpm2_startauthsession -S session.ctx

# 在策略中加入 PCR 条件："PCR 16 的值必须等于 pcr_values.bin 中记录的"
tpm2_policypcr -S session.ctx -l sha256:16 -f pcr_values.bin -L my_policy.bin

# 结束会话
tpm2_flushcontext session.ctx
```

现在 `my_policy.bin` 就是你的策略文件。它编码了"PCR 16 必须等于当前值"这个条件。

### 2.5 密封秘密数据

TPM 的安全存储区极小，通常**直接密封的数据不能超过 128 字节**！
（在真实场景中，我们只用 TPM 密封几十个字节的 AES 密钥，再用 AES 加密大文件。）

我们先生成一个短小的核心机密：

```bash
echo "MySecretKey-123456" > test_files/secret.txt
cat test_files/secret.txt
```

现在把它密封：

```bash
tpm2_create -C primary.ctx -L my_policy.bin -i test_files/secret.txt \
    -u sealed.pub -r sealed.priv
```

| 参数 | 含义 |
|------|------|
| `-C primary.ctx` | 父密钥是刚才创建的主密钥 |
| `-L my_policy.bin` | 使用我们定义的 PCR 策略 |
| `-i test_files/secret.txt` | 要密封的输入数据 |
| `-u sealed.pub` | 输出：密封对象的公开部分 |
| `-r sealed.priv` | 输出：密封对象的私密部分（已加密） |

然后加载到 TPM：

> 💡 **避坑指南 - TPM 内存限制：**
> 真实的 TPM 芯片“瞬态内存”通常只有 **3个插槽**。上一步 `tpm2_create` 命令底层执行完毕时，往往会遗留占用的内存句柄没有自动释放。
> 为了防止由于内存爆满而导致的 `out of memory for object contexts (0x902)` 错误，我们必须**手动清理一次瞬态内存**，腾出空间后再加载！

```bash
tpm2_flushcontext -t
tpm2_load -C primary.ctx -u sealed.pub -r sealed.priv -c sealed.ctx
```

### 2.6 解封 —— 系统状态正常

现在 PCR 16 的值还没变，应该能成功解封：

```bash
# 开始一个策略会话
tpm2_startauthsession -S session.ctx --policy-session

# "证明"当前 PCR 值满足策略
tpm2_policypcr -S session.ctx -l sha256:16

# 解封！(别忘了老规矩，由于没有资源管理器，加载前先冲洗掉前人的垃圾对象)
tpm2_flushcontext -t 2>/dev/null || true
tpm2_unseal -c sealed.ctx -p session:session.ctx

# 清理会话
tpm2_flushcontext session.ctx
```

你应该看到 secret.txt 的内容被原样输出！✅

### 2.7 模拟攻击 —— 篡改系统后解封失败

现在我们模拟攻击者修改了系统配置（改变了 PCR 16）：

```bash
# 模拟篡改：往 PCR 16 扩展一个新值
echo -n "MALWARE" | sha256sum | awk '{print $1}'
tpm2_pcrextend 16:sha256=<上面的哈希>

# 看看 PCR 16 变了
tpm2_pcrread sha256:16
```

PCR 16 的值已经变了。现在尝试解封：

```bash
tpm2_startauthsession -S session.ctx --policy-session
tpm2_policypcr -S session.ctx -l sha256:16

# 同样的，尝试解封前先清空旧垃圾
tpm2_flushcontext -t 2>/dev/null || true
tpm2_unseal -c sealed.ctx -p session:session.ctx
```

💥 **你应该看到一个错误！**（类似 `TPM2_RC_POLICY_FAIL`）

TPM 发现当前 PCR 16 的值和密封时记录的不一样，**拒绝释放数据**。

```bash
# 记得清理会话
tpm2_flushcontext session.ctx
```

### 2.8 思考题

> ❓ 这个机制可以用来做什么？（提示：全盘加密 LUKS 密钥保护）
> ❓ 如果攻击者获取了 sealed.pub 和 sealed.priv 文件，能否在另一台电脑上解封？

---

## 实验三：远程证明 (Remote Attestation)

### 核心概念

远程证明解决的问题：**"我怎么知道远程那台机器的软件有没有被篡改？"**

答案：让那台机器的 TPM 对 PCR 值进行**签名**，我拿到签名后用公钥验证。
因为签名是 TPM 硬件内部用私钥做的，攻击者无法伪造。

角色分工：
- **平台方 (Attester)**: 被验证的设备（有 TPM）
- **验证方 (Verifier)**: 要确认对方可信的远程管理员

### 3.1 准备 —— 先清理之前的上下文

```bash
tpm2_flushcontext -t
tpm2_flushcontext -l
tpm2_flushcontext -s
```

### 3.2 创建背书密钥 (EK)

EK（Endorsement Key）是 TPM 的"身份证"。在真实场景中，EK 是 TPM 制造商出厂时注入的。

```bash
tpm2_createek -c ek.ctx -G rsa -u ek.pub
```

### 3.3 创建证明身份密钥 (AK)

AK（Attestation Key）是专门用来签名 Quote 的密钥。它从 EK 派生，保护了 EK 的隐私。

```bash
tpm2_createak -C ek.ctx -c ak.ctx -G rsa -g sha256 -s rsassa \
    -u ak.pub -n ak.name
```

导出 AK 公钥（发给验证方）：

```bash
tpm2_flushcontext -t 2>/dev/null || true
tpm2_readpublic -c ak.ctx -f pem -o ak.pem
cat ak.pem
```

### 3.4 验证方生成 Nonce

```bash
NONCE=$(openssl rand -hex 16)
echo "随机挑战 Nonce: 0x${NONCE}"
```

> 💡 **为什么需要 Nonce?**
> 防止重放攻击。如果没有 Nonce，攻击者可以录下上次的 Quote，
> 以后系统被篡改后还能重放旧的 Quote 来骗过验证方。

### 3.5 平台方生成 Quote

```bash
tpm2_flushcontext -t 2>/dev/null || true
tpm2_quote -c ak.ctx -l sha256:0,1,2 -q ${NONCE} \
    -m quote.msg -s quote.sig -o quote_pcr.bin -g sha256
```

| 参数 | 含义 |
|------|------|
| `-c ak.ctx` | 用 AK 签名 |
| `-l sha256:0,1,2` | 报告 PCR 0、1、2 的值 |
| `-q 0x${NONCE}` | 包含验证方的 Nonce |
| `-m quote.msg` | 输出：签名的消息体 |
| `-s quote.sig` | 输出：数字签名 |
| `-o quote_pcr.bin` | 输出：实际的 PCR 值 |

### 3.6 验证方验证 Quote

```bash
tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig \
    -f quote_pcr.bin -q ${NONCE}
```

如果输出没有报错，说明：
- ✅ 签名有效 → Quote 确实来自拥有 AK 私钥的 TPM
- ✅ Nonce 匹配 → 这是一个新鲜的回复，不是重放
- ✅ PCR 值可信 → 可以对比已知基线

### 3.7 试试用错误的 Nonce 验证

```bash
WRONG_NONCE=$(openssl rand -hex 16)
tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig \
    -f quote_pcr.bin -q ${WRONG_NONCE}
```

❌ 应该报错！因为 Nonce 不匹配。

### 3.8 思考题

> ❓ 完整的远程证明流程需要几次网络通信？
> ❓ 验证方怎么知道 AK 公钥是真的（而不是攻击者伪造的）？（提示：EK 证书链）

---

## 实验四：PKCS#11 接口（选做）

> 这部分依赖额外的软件包，如果安装失败可以跳过。

### 核心概念

PKCS#11 是一个**标准化的密码令牌接口**。浏览器、OpenSSL、SSH 等程序都支持它。
通过 `tpm2-pkcs11` 模块，TPM 就变成了一个标准的"虚拟智能卡"。

### 4.1 安装额外依赖

```bash
sudo apt install -y libtpm2-pkcs11-1 libtpm2-pkcs11-tools opensc \
    tpm2-abrmd libtss2-tcti-tabrmd0 libtss2-tcti-tabrmd-dev
```

### 4.2 启动资源管理器 (tpm2-abrmd)

> ⚠️ **为什么 PKCS#11 必须使用资源管理器？**
> `tpm2_ptool` 底层会在**单条命令内部**连续发起多次 TPM 操作（创建主密钥 → 创建子密钥 → 签名验证），
> 轻松占满仅有的 3 个瞬态内存插槽。手动 `tpm2_flushcontext` 无法解决这个问题，
> 因为插槽是在工具自己的内部被撑爆的，外部根本来不及清理。
> 资源管理器 `tpm2-abrmd` 就像操作系统的虚拟内存，能自动进行"换页"调度。

```bash
# 进入带有私有 D-Bus 总线的子终端
dbus-run-session bash

# 在子终端中启动资源管理器（后台挂起，对接 swtpm 模拟器）
tpm2-abrmd --tcti="swtpm:host=localhost,port=2321" --session &
sleep 1
```

### 4.3 设置 PKCS#11 环境

现在所有工具都必须通过资源管理器来访问 TPM（不再直连 swtpm）：

```bash
export TPM2TOOLS_TCTI="tabrmd:bus_type=session"
export TPM2_PKCS11_TCTI="tabrmd:bus_type=session"
export TPM2_PKCS11_STORE="/tmp/tpm-pkcs11-store"
mkdir -p $TPM2_PKCS11_STORE
```

验证资源管理器是否工作正常：

```bash
tpm2_pcrread sha256:0
```

如果正常输出 PCR 值，说明资源管理器已接管通信。

### 4.4 初始化并创建 Token

有了资源管理器，以下命令可以一气呵成，无需手动清理内存：

```bash
rm -rf /tmp/tpm-pkcs11-store/*
tpm2_ptool init
tpm2_ptool addtoken --pid=1 --label=mytoken --sopin=sopin123 --userpin=userpin123
tpm2_ptool addkey --label=mytoken --userpin=userpin123 --algorithm=rsa2048
```

### 4.5 用 pkcs11-tool 查看

```bash
# 找到 PKCS#11 模块的位置
find /usr/lib -name "libtpm2_pkcs11.so" 2>/dev/null

# 列出 slots（用上面找到的路径替换）
PKCS11_LIB="/usr/lib/x86_64-linux-gnu/libtpm2_pkcs11.so"
pkcs11-tool --module $PKCS11_LIB -L
pkcs11-tool --module $PKCS11_LIB -O --login --pin userpin123
```

### 4.6 思考题

> ❓ 和直接用 tpm2-tools 相比，PKCS#11 的优势是什么？
> ❓ 哪些日常应用可以使用 PKCS#11 接口?（提示：浏览器 TLS 客户端证书、SSH 认证）
> ❓ 为什么实验 1-3 可以直连 swtpm，而实验 4 必须通过资源管理器？

---

## 实验结束：清理

```bash
# 回到第一个终端，Ctrl+C 停止 swtpm
# 或者：
pkill swtpm

# 清理临时文件
rm -rf /tmp/tpm-state /tmp/tpm-pkcs11-store
rm -f *.ctx *.pub *.priv *.bin *.pem *.name *.sig *.msg
```

---

## 附录：关键概念速查表

| 概念 | 一句话解释 |
|------|-----------|
| **PCR** | TPM 内部的"只能加不能改"的寄存器，记录系统度量值 |
| **扩展 (Extend)** | PCR_new = Hash(PCR_old \|\| data)，单向累积 |
| **密封 (Seal)** | 加密数据 + 绑定 PCR 条件 = 只有正确状态才能解密 |
| **解封 (Unseal)** | 向 TPM 请求解密，TPM 自动检查 PCR 条件 |
| **EK** | 背书密钥，TPM 的"身份证"，出厂写入 |
| **AK** | 证明密钥，从 EK 派生，专用于签名 Quote |
| **Quote** | TPM 签名的 PCR 报告 + Nonce，用于远程证明 |
| **Nonce** | 一次性随机数，防止重放攻击 |
| **TCTI** | 命令传输接口，定义怎么连接到 TPM |
| **PKCS#11** | 标准密码令牌 API，让 TPM 像智能卡一样被使用 |
| **策略 (Policy)** | 定义操作的授权条件（如 PCR 值必须匹配） |
