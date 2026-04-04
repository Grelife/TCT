#!/bin/bash
# ============================================================
# 04_attestation.sh — 远程证明演示
# 演示 TPM 如何向远程验证方证明平台的可信状态
#
# 角色:
#   • 平台方 (Attester): 拥有 TPM 的设备
#   • 验证方 (Verifier): 远程服务器/管理员
#
# 流程:
#   1. 验证方发送随机 nonce (防重放)
#   2. 平台方使用 AK 签名 PCR 值生成 Quote
#   3. 验证方验证 Quote 签名和 PCR 值
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/tpm_helpers.sh"

print_banner "${ICON_REPORT} 演示 3: 远程证明 (Remote Attestation)"

# --- 前置检查 ---
check_environment
setup_work_dir "attestation"

# ============================================================
# 步骤 1: 准备平台度量状态
# ============================================================
print_step "1" "准备平台度量状态"
print_info "模拟系统启动过程中的度量，将可信基线写入 PCR"

# 度量一些 "系统组件"
BOOTLOADER_HASH=$(echo -n "GRUB-2.06-trusted-bootloader" | sha256sum | awk '{print $1}')
KERNEL_HASH=$(echo -n "linux-5.15.0-generic-ubuntu" | sha256sum | awk '{print $1}')
CONFIG_HASH=$(echo -n "system-config-baseline-v1.0" | sha256sum | awk '{print $1}')

print_substep "度量 Bootloader → PCR 0"
tpm2_pcrextend "0:sha256=${BOOTLOADER_HASH}" 2>/dev/null

print_substep "度量 Kernel → PCR 1"
tpm2_pcrextend "1:sha256=${KERNEL_HASH}" 2>/dev/null

print_substep "度量 配置 → PCR 2"
tpm2_pcrextend "2:sha256=${CONFIG_HASH}" 2>/dev/null

print_success "平台度量完成，PCR 0-2 已记录启动信息"

# 显示 PCR 值
print_cmd "tpm2_pcrread sha256:0,1,2"
PCR_VALUES=$(tpm2_pcrread sha256:0,1,2 2>/dev/null)
print_output "$PCR_VALUES"

# ============================================================
# 步骤 2: 创建背书密钥 (EK)
# ============================================================
print_step "2" "创建背书密钥 (Endorsement Key, EK)"
print_info "EK 是 TPM 的身份标识，由制造商在出厂时创建"
print_info "在模拟器中，我们手动创建 EK"

flush_all_contexts

print_cmd "tpm2_createek -c ek.ctx -G rsa -u ek.pub"
tpm2_createek -c ek.ctx -G rsa -u ek.pub 2>/dev/null
print_success "背书密钥 (EK) 已创建"
print_substep "EK 用于证明 TPM 的真实性"

# ============================================================
# 步骤 3: 创建证明身份密钥 (AK)
# ============================================================
print_step "3" "创建证明身份密钥 (Attestation Key, AK)"
print_info "AK 派生自 EK，专门用于签名 Quote (平台证明报告)"
print_info "AK 保护了 EK 的隐私 (EK 不直接用于签名)"

print_cmd "tpm2_createak -C ek.ctx -c ak.ctx -G rsa -g sha256 -s rsassa -u ak.pub -n ak.name"
tpm2_createak -C ek.ctx -c ak.ctx -G rsa -g sha256 -s rsassa -u ak.pub -n ak.name 2>/dev/null
print_success "证明身份密钥 (AK) 已创建"

# 导出 AK 公钥 (PEM 格式)
print_cmd "tpm2_readpublic -c ak.ctx -f pem -o ak.pem"
tpm2_readpublic -c ak.ctx -f pem -o ak.pem 2>/dev/null
print_substep "AK 公钥已导出 (ak.pem)"
print_info "验证方需要 AK 公钥来验证 Quote 签名"

echo ""
print_substep "AK 公钥内容:"
print_output "$(cat ak.pem)"

# ============================================================
# 步骤 4: 验证方发送 Nonce (模拟远程挑战)
# ============================================================
print_step "4" "验证方发送随机挑战 (Nonce)"
print_info "Nonce 用于防止重放攻击"
print_info "每次证明请求使用不同的随机 Nonce"

NONCE=$(openssl rand -hex 16)
print_compare "Nonce (十六进制)" "0x${NONCE}"
print_substep "验证方 → 平台方: \"请用这个 Nonce 生成 Quote\""

# ============================================================
# 步骤 5: 平台方生成 Quote (签名的 PCR 报告)
# ============================================================
print_step "5" "平台方生成 Quote (签名的 PCR 报告)"
print_info "TPM 使用 AK 私钥对 PCR 值进行签名"
print_info "Quote 包含: PCR 值 + Nonce + AK 签名"

print_cmd "tpm2_quote -c ak.ctx -l sha256:0,1,2 -q 0x${NONCE} -m quote.msg -s quote.sig -o quote_pcr.bin -g sha256"
tpm2_quote -c ak.ctx -l sha256:0,1,2 -q "0x${NONCE}" \
    -m quote.msg -s quote.sig -o quote_pcr.bin -g sha256 2>/dev/null
print_success "Quote 已生成！"

print_substep "quote.msg  - 签名的消息体 (包含 PCR 摘要和 Nonce)"
print_substep "quote.sig  - AK 的数字签名"
print_substep "quote_pcr.bin - 引用的 PCR 值"

# 显示文件大小
echo ""
print_substep "生成的证明文件:"
for f in quote.msg quote.sig quote_pcr.bin; do
    size=$(wc -c < "$f")
    print_info "    ${f}: ${size} 字节"
done

# ============================================================
# 步骤 6: 验证方验证 Quote
# ============================================================
print_step "6" "验证方验证 Quote"
print_info "验证方收到 Quote 后，使用 AK 公钥验证签名"
print_info "同时检查 Nonce 是否匹配（防止重放攻击）"

print_cmd "tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q 0x${NONCE}"
VERIFY_OUTPUT=$(tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q "0x${NONCE}" 2>&1)
VERIFY_RESULT=$?

echo ""
if [ $VERIFY_RESULT -eq 0 ]; then
    print_output "$VERIFY_OUTPUT"
    echo ""
    print_success "${ICON_SHIELD} Quote 验证成功！"
    print_info "验证方确认:"
    print_info "  ✓ 签名有效 → Quote 来自拥有 AK 私钥的 TPM"
    print_info "  ✓ Nonce 匹配 → Quote 是新鲜的 (非重放)"
    print_info "  ✓ PCR 0-2 的值可信 → 平台启动链未被篡改"
else
    print_error "Quote 验证失败！"
    print_output "$VERIFY_OUTPUT"
fi

# ============================================================
# 步骤 7: 模拟篡改后验证失败
# ============================================================
print_step "7" "模拟篡改 —— 使用错误的 Nonce 验证"
print_info "攻击者试图用旧的 Quote 进行重放攻击"

WRONG_NONCE=$(openssl rand -hex 16)
print_compare "正确 Nonce" "0x${NONCE}"
print_compare "错误 Nonce" "0x${WRONG_NONCE}"

print_cmd "tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q 0x${WRONG_NONCE}"
echo ""
if tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q "0x${WRONG_NONCE}" 2>/dev/null; then
    print_warning "验证竟然通过了？请检查 tpm2-tools 版本"
else
    print_error "${ICON_SHIELD} 验证失败！Nonce 不匹配"
    print_info "重放攻击被成功阻止"
fi

# ============================================================
# 步骤 8: 总结远程证明流程
# ============================================================
print_step "8" "远程证明流程总结"

echo ""
print_info "    ${BOLD}远程证明的完整流程:${NC}"
echo ""
print_info "    ┌──────────────┐          ┌──────────────┐"
print_info "    │   验证方     │          │   平台方     │"
print_info "    │  (Verifier)  │          │  (Attester)  │"
print_info "    └──────┬───────┘          └──────┬───────┘"
print_info "           │                         │"
print_info "           │  1. 发送 Nonce           │"
print_info "           │ ─────────────────────── │"
print_info "           │                         │ 2. TPM 签名 PCR"
print_info "           │                         │    生成 Quote"
print_info "           │  3. 返回 Quote+签名     │"
print_info "           │ ─────────────────────── │"
print_info "           │ 4. 验证签名             │"
print_info "           │    检查 Nonce            │"
print_info "           │    对比 PCR 基线         │"
print_info "           │                         │"
echo ""
print_info "    ${BOLD}安全保证:${NC}"
print_info "    • 不可伪造 — Quote 由 TPM 内部的 AK 私钥签名"
print_info "    • 防重放 — 每次使用不同 Nonce"
print_info "    • 真实性 — AK 绑定到 EK，EK 证明 TPM 身份"
echo ""

# --- 清理 ---
flush_all_contexts
print_info "下一步: bash scripts/05_pkcs11.sh (PKCS#11 接口演示)"
print_demo_end "远程证明"
