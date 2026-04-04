#!/bin/bash
# ============================================================
# 03_seal_unseal.sh — 数据密封与解封演示
# 演示 TPM 将数据绑定到特定平台状态的能力
#
# 核心概念:
#   密封 (Seal): 加密数据并绑定到当前 PCR 状态
#   解封 (Unseal): 仅当 PCR 状态匹配时才释放数据
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/tpm_helpers.sh"

print_banner "${ICON_LOCK} 演示 2: 数据密封与解封 (Seal/Unseal)"

# --- 前置检查 ---
check_environment
setup_work_dir "seal_unseal"

# 准备要密封的秘密数据
cp "${PROJECT_ROOT}/test_files/secret.txt" ./secret.txt

# ============================================================
# 步骤 1: 准备 —— 对系统文件进行度量（建立可信基线）
# ============================================================
print_step "1" "建立可信基线 —— PCR 度量"
print_info "首先对系统关键配置进行度量，建立信任基线"
print_info "使用 PCR 16（用户自定义 PCR，可被重置）"

# 度量配置文件
cp "${PROJECT_ROOT}/test_files/config_baseline.txt" ./baseline.txt
CONFIG_HASH=$(compute_sha256 baseline.txt)
print_substep "配置文件哈希: ${CONFIG_HASH:0:32}..."

print_cmd "tpm2_pcrextend 16:sha256=${CONFIG_HASH}"
tpm2_pcrextend "16:sha256=${CONFIG_HASH}" 2>/dev/null
print_success "PCR 16 已扩展（记录系统配置度量值）"

# 显示当前 PCR 值
PCR_BASELINE=$(read_pcr_value 16)
print_compare "PCR[16] 基线值" "${PCR_BASELINE:0:32}..."

# ============================================================
# 步骤 2: 创建主密钥 (Primary Key)
# ============================================================
print_step "2" "在 Owner 层级创建主密钥"
print_info "主密钥是 TPM 密钥层级结构的根，用于派生子密钥"

flush_all_contexts

print_cmd "tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx"
tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx 2>/dev/null
print_success "主密钥已创建"

# ============================================================
# 步骤 3: 创建 PCR 授权策略
# ============================================================
print_step "3" "创建基于 PCR 的授权策略"
print_info "策略规定：只有当 PCR 16 的值与当前值匹配时，才允许操作"

# 读取当前 PCR 值
print_cmd "tpm2_pcrread -o pcr_current.bin sha256:16"
tpm2_pcrread -o pcr_current.bin sha256:16 2>/dev/null

# 创建策略
print_cmd "tpm2_startauthsession -S session.ctx"
tpm2_startauthsession -S session.ctx 2>/dev/null

print_cmd "tpm2_policypcr -S session.ctx -l sha256:16 -f pcr_current.bin -L pcr.policy"
tpm2_policypcr -S session.ctx -l sha256:16 -f pcr_current.bin -L pcr.policy 2>/dev/null

print_cmd "tpm2_flushcontext session.ctx"
tpm2_flushcontext session.ctx 2>/dev/null

print_success "PCR 策略已创建 (pcr.policy)"
POLICY_HASH=$(sha256sum pcr.policy | awk '{print $1}')
print_compare "策略哈希" "${POLICY_HASH:0:32}..."

# ============================================================
# 步骤 4: 密封秘密数据
# ============================================================
print_step "4" "密封秘密数据到 TPM"
print_info "将 secret.txt 的内容密封，绑定到 PCR 策略"

echo ""
print_substep "待密封的秘密内容:"
print_output "$(cat secret.txt)"
echo ""

print_cmd "tpm2_create -C primary.ctx -L pcr.policy -i secret.txt -u seal.pub -r seal.priv"
tpm2_create -C primary.ctx -L pcr.policy -i secret.txt -u seal.pub -r seal.priv 2>/dev/null
print_success "数据已密封！"
print_info "密封后的数据由 TPM 保护，只有满足 PCR 策略才能解封"

# 加载密封对象
print_cmd "tpm2_load -C primary.ctx -u seal.pub -r seal.priv -c seal.ctx"
tpm2_load -C primary.ctx -u seal.pub -r seal.priv -c seal.ctx 2>/dev/null
print_substep "密封对象已加载到 TPM"

# ============================================================
# 步骤 5: 正常解封 (PCR 未改变)
# ============================================================
print_step "5" "尝试解封 —— 系统状态未被篡改"
print_info "当前 PCR 状态与密封时一致，应当成功解封"

print_cmd "tpm2_startauthsession -S session.ctx --policy-session"
tpm2_startauthsession -S session.ctx --policy-session 2>/dev/null

print_cmd "tpm2_policypcr -S session.ctx -l sha256:16"
tpm2_policypcr -S session.ctx -l sha256:16 2>/dev/null

echo ""
print_substep "${GREEN}${BOLD}解封结果:${NC}"
print_cmd "tpm2_unseal -c seal.ctx -p session:session.ctx"
UNSEALED=$(tpm2_unseal -c seal.ctx -p session:session.ctx 2>/dev/null)
echo ""
print_output "$UNSEALED"
echo ""
print_success "${ICON_UNLOCK} 解封成功！秘密数据已恢复"

tpm2_flushcontext session.ctx 2>/dev/null

# 验证数据完整性
ORIGINAL=$(cat secret.txt)
if [ "$UNSEALED" = "$ORIGINAL" ]; then
    print_success "数据完整性验证通过：解封内容与原始内容完全一致"
fi

# ============================================================
# 步骤 6: 模拟系统被篡改 (修改 PCR)
# ============================================================
print_step "6" "模拟攻击 —— 系统配置被篡改"
print_warning "攻击者修改了系统配置，PCR 值将发生变化"

# 模拟篡改：扩展 PCR 16 (相当于系统配置发生了变化)
TAMPER_DATA="SYSTEM_COMPROMISED_BY_ATTACKER"
TAMPER_HASH=$(echo -n "$TAMPER_DATA" | sha256sum | awk '{print $1}')
print_substep "攻击者篡改数据: ${TAMPER_DATA}"

print_cmd "tpm2_pcrextend 16:sha256=${TAMPER_HASH}"
tpm2_pcrextend "16:sha256=${TAMPER_HASH}" 2>/dev/null
print_warning "PCR 16 已被篡改！"

PCR_TAMPERED=$(read_pcr_value 16)
print_compare "密封时的 PCR 值" "${PCR_BASELINE:0:32}..."
print_compare "篡改后的 PCR 值" "${PCR_TAMPERED:0:32}..."
print_warning "两个值不同 → 平台状态已改变"

# ============================================================
# 步骤 7: 篡改后尝试解封 (应当失败)
# ============================================================
print_step "7" "尝试解封 —— 系统已被篡改"
print_info "PCR 值已改变，TPM 应当拒绝解封"

print_cmd "tpm2_startauthsession -S session.ctx --policy-session"
tpm2_startauthsession -S session.ctx --policy-session 2>/dev/null

print_cmd "tpm2_policypcr -S session.ctx -l sha256:16"
# 注意：这里 policypcr 可能会失败，因为 PCR 值已变
# 即使 policypcr 成功，unseal 也会因策略不匹配而失败

echo ""
if tpm2_policypcr -S session.ctx -l sha256:16 2>/dev/null; then
    print_cmd "tpm2_unseal -c seal.ctx -p session:session.ctx"
    if UNSEAL_RESULT=$(tpm2_unseal -c seal.ctx -p session:session.ctx 2>&1); then
        # 不应该到这里
        print_output "$UNSEAL_RESULT"
    else
        echo ""
        print_error "${ICON_LOCK} 解封失败！TPM 拒绝释放数据"
        print_info "原因: 当前 PCR 值与策略中记录的不匹配"
        print_info "错误信息: $(echo "$UNSEAL_RESULT" | tail -1)"
    fi
else
    echo ""
    print_error "${ICON_LOCK} 策略验证失败！PCR 值不匹配"
    print_info "TPM 检测到平台状态与密封时不同，拒绝操作"
fi

tpm2_flushcontext session.ctx 2>/dev/null || true
echo ""

# ============================================================
# 步骤 8: 总结
# ============================================================
print_step "8" "密封/解封机制总结"

echo ""
print_info "    ${BOLD}密封 (Seal) 的安全意义:${NC}"
print_info "    • 数据加密存储，由 TPM 硬件保护密钥"
print_info "    • 绑定到特定平台状态 (PCR 值)"
print_info "    • 即使硬盘被盗，没有正确的 TPM 和平台状态也无法解密"
echo ""
print_info "    ${BOLD}实际应用场景:${NC}"
print_info "    • 全盘加密 (如 Linux LUKS + TPM)"
print_info "    • 密钥保护 (密钥绑定到特定启动配置)"
print_info "    • 条件访问控制 (仅在可信环境下解锁敏感资源)"
echo ""

# --- 清理 ---
flush_all_contexts
print_info "下一步: bash scripts/04_attestation.sh (远程证明演示)"
print_demo_end "数据密封与解封"
