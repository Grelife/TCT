#!/bin/bash
# ============================================================
# 06_full_demo.sh — 完整演示流程
# 将四大功能串联为 "TPM 安全文件保险箱" 完整工作流
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/tpm_helpers.sh"

print_banner "${ICON_SHIELD} TPM 安全文件保险箱 — 完整演示"

echo ""
print_info "本演示将 TPM 四大核心功能串联为一个完整的安全工作流:"
echo ""
print_info "    场景: 一个基于 TPM 的安全文件保险箱系统"
echo ""
print_info "    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐"
print_info "    │ 1.度量  │──▶│ 2.密封  │──▶│ 3.证明  │──▶│ 4.PKCS  │"
print_info "    │ PCR     │   │ Seal    │   │ Attest  │   │ #11     │"
print_info "    └─────────┘   └─────────┘   └─────────┘   └─────────┘"
echo ""

# --- 前置检查 ---
check_environment

# ============================================================
# 阶段 1: 度量 —— 记录系统可信基线
# ============================================================
print_banner "阶段 1/4: 系统度量 (Measurement)"
print_info "保险箱系统启动时，首先度量自身环境的完整性"

setup_work_dir "full_demo"
cp "${PROJECT_ROOT}/test_files/config_baseline.txt" ./baseline.txt
echo "MyVaultSecret-1234" > ./vault_secret.txt

flush_all_contexts

# 度量系统组件
BOOT_HASH=$(echo -n "trusted-bootloader-v2.0" | sha256sum | awk '{print $1}')
APP_HASH=$(compute_sha256 baseline.txt)

print_substep "度量引导程序 → PCR 0"
tpm2_pcrextend "0:sha256=${BOOT_HASH}" 2>/dev/null

print_substep "度量保险箱配置 → PCR 16"
tpm2_pcrextend "16:sha256=${APP_HASH}" 2>/dev/null

print_success "系统度量完成，可信基线已建立"
print_cmd "tpm2_pcrread sha256:0,16"
tpm2_pcrread sha256:0,16 2>/dev/null | while IFS= read -r l; do print_output "$l"; done

wait_for_enter "度量完成。按回车进入密封阶段..."

# ============================================================
# 阶段 2: 密封 —— 锁定保险箱密钥
# ============================================================
print_banner "阶段 2/4: 数据密封 (Seal)"
print_info "将保险箱中的秘密文件密封到 TPM，绑定到当前 PCR 状态"

# 创建主密钥
tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx 2>/dev/null
print_substep "主密钥已创建"

# 创建 PCR 策略 (绑定 PCR 0 和 16)
tpm2_pcrread -o pcr.bin sha256:0,16 2>/dev/null
tpm2_startauthsession -S session.ctx 2>/dev/null
tpm2_policypcr -S session.ctx -l sha256:0,16 -f pcr.bin -L pcr.policy 2>/dev/null
tpm2_flushcontext session.ctx 2>/dev/null
print_substep "PCR 授权策略已创建 (绑定 PCR 0,16)"

# 密封保险箱秘密
tpm2_create -C primary.ctx -L pcr.policy -i vault_secret.txt -u seal.pub -r seal.priv 2>/dev/null
tpm2_flushcontext -t 2>/dev/null || true
tpm2_load -C primary.ctx -u seal.pub -r seal.priv -c seal.ctx 2>/dev/null
print_success "${ICON_LOCK} 保险箱已锁定！秘密文件已密封到 TPM"

wait_for_enter "密封完成。按回车进入远程证明阶段..."

# ============================================================
# 阶段 3: 远程证明 —— 管理员验证平台
# ============================================================
print_banner "阶段 3/4: 远程证明 (Attestation)"
print_info "远程管理员通过证明验证保险箱所在平台是否可信"

flush_all_contexts

# 创建 EK 和 AK
tpm2_createek -c ek.ctx -G rsa -u ek.pub 2>/dev/null
print_substep "背书密钥 (EK) 已创建"

tpm2_createak -C ek.ctx -c ak.ctx -G rsa -g sha256 -s rsassa -u ak.pub -n ak.name 2>/dev/null
print_substep "证明身份密钥 (AK) 已创建"

# 管理员发送 Nonce
NONCE=$(openssl rand -hex 16)
print_substep "管理员发送挑战 Nonce: 0x${NONCE}"

# 生成 Quote
tpm2_flushcontext -t 2>/dev/null || true
tpm2_quote -c ak.ctx -l sha256:0,16 -q "${NONCE}" -m quote.msg -s quote.sig -o quote_pcr.bin -g sha256 2>/dev/null
print_substep "Quote 已生成"

# 验证 Quote
if tpm2_checkquote -u ak.pub -m quote.msg -s quote.sig -f quote_pcr.bin -q "${NONCE}" 2>/dev/null; then
    print_success "${ICON_SHIELD} 远程证明验证通过！管理员确认平台可信"
else
    print_error "远程证明验证失败"
fi

wait_for_enter "证明通过。按回车解封保险箱..."

# ============================================================
# 阶段 3.5: 成功解封
# ============================================================
print_banner "解封保险箱"
print_info "平台验证通过，现在可以安全地解封保险箱"

# 重新创建主密钥和加载密封对象（因为 flush 过了）
flush_all_contexts
tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx 2>/dev/null
tpm2_flushcontext -t 2>/dev/null || true
tpm2_load -C primary.ctx -u seal.pub -r seal.priv -c seal.ctx 2>/dev/null

tpm2_startauthsession -S session.ctx --policy-session 2>/dev/null
tpm2_policypcr -S session.ctx -l sha256:0,16 2>/dev/null

UNSEALED=$(tpm2_unseal -c seal.ctx -p session:session.ctx 2>/dev/null)
tpm2_flushcontext session.ctx 2>/dev/null

print_success "${ICON_UNLOCK} 保险箱已解封！"
echo ""
print_substep "解封的秘密内容:"
print_output "$UNSEALED"

wait_for_enter "按回车模拟攻击场景..."

# ============================================================
# 阶段 4: 攻击模拟 —— 保险箱防御
# ============================================================
print_banner "攻击模拟: 系统被篡改"
print_warning "攻击者修改了系统配置，尝试窃取保险箱内容"

TAMPER=$(echo -n "MALWARE_INJECTED" | sha256sum | awk '{print $1}')
tpm2_pcrextend "16:sha256=${TAMPER}" 2>/dev/null
print_error "PCR 16 已被篡改！(恶意软件注入)"

# 尝试解封
flush_all_contexts
tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx 2>/dev/null
tpm2_flushcontext -t 2>/dev/null || true
tpm2_load -C primary.ctx -u seal.pub -r seal.priv -c seal.ctx 2>/dev/null

tpm2_startauthsession -S session.ctx --policy-session 2>/dev/null

if tpm2_policypcr -S session.ctx -l sha256:0,16 2>/dev/null; then
    if tpm2_unseal -c seal.ctx -p session:session.ctx 2>/dev/null; then
        print_warning "不应该到这里"
    else
        print_error "${ICON_LOCK} 解封被 TPM 拒绝！攻击被阻止！"
        print_info "原因: PCR 值与密封时不匹配"
    fi
else
    print_error "${ICON_LOCK} PCR 策略校验失败！攻击被阻止！"
fi
tpm2_flushcontext session.ctx 2>/dev/null || true

echo ""
print_success "TPM 成功保护了保险箱中的秘密数据"
print_info "即使攻击者获得了物理访问权限，没有正确的系统状态也无法解封"

# ============================================================
# 总结
# ============================================================
echo ""
print_banner "演示总结"
echo ""
print_info "    TPM 安全文件保险箱完整工作流:"
echo ""
print_info "    ${ICON_MEASURE} 度量    → 建立系统可信基线，记录到 PCR"
print_info "    ${ICON_LOCK} 密封    → 将秘密绑定到 PCR 状态"
print_info "    ${ICON_REPORT} 证明    → 远程验证平台可信"
print_info "    ${ICON_UNLOCK} 解封    → 平台可信时解封秘密"
print_info "    ${ICON_SHIELD} 防御    → 系统被篡改时拒绝解封"
echo ""
print_info "    核心安全原理: 信任链 (Chain of Trust)"
print_info "    硬件 TPM → 固件 → 引导 → 内核 → 应用"
echo ""

flush_all_contexts
print_demo_end "TPM 安全文件保险箱"
