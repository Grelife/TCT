#!/bin/bash
# ============================================================
# 02_measurement.sh — PCR 度量演示
# 演示 TPM 平台配置寄存器 (PCR) 的扩展度量机制
#
# 核心概念:
#   PCR_new = Hash(PCR_old || Data_hash)
#   PCR 只能扩展，不能直接设置或回退
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/tpm_helpers.sh"

print_banner "${ICON_MEASURE} 演示 1: PCR 度量 (Measurement)"

# --- 前置检查 ---
check_environment
setup_work_dir "measurement"

# 复制测试文件到工作目录
cp "${PROJECT_ROOT}/test_files/config_baseline.txt" ./config.txt

# ============================================================
# 步骤 1: 读取初始 PCR 值
# ============================================================
print_step "1" "读取初始 PCR 值 (PCR 10)"
print_info "PCR 10 通常用于应用层度量 (IMA 使用 PCR 10)"
print_info "在 TPM 模拟器重启后，所有 PCR 初始值为全零"

print_cmd "tpm2_pcrread sha256:10"
PCR_INITIAL=$(tpm2_pcrread sha256:10 2>/dev/null)
print_output "$PCR_INITIAL"

PCR_VALUE_INITIAL=$(read_pcr_value 10)
print_compare "PCR[10] 初始值" "$PCR_VALUE_INITIAL"

# ============================================================
# 步骤 2: 对配置文件进行度量
# ============================================================
print_step "2" "计算配置文件的 SHA-256 哈希值"
print_info "目标文件: config.txt (系统配置基线)"

print_cmd "sha256sum config.txt"
FILE_HASH=$(compute_sha256 config.txt)
print_compare "文件哈希" "$FILE_HASH"

print_separator

# ============================================================
# 步骤 3: 将哈希值扩展到 PCR
# ============================================================
print_step "3" "将文件哈希扩展到 PCR 10"
print_info "执行: PCR_new = SHA256(PCR_old || file_hash)"
print_info "这模拟了系统在启动时对配置文件的完整性度量"

print_cmd "tpm2_pcrextend 10:sha256=${FILE_HASH}"
tpm2_pcrextend "10:sha256=${FILE_HASH}" 2>/dev/null
print_success "PCR 扩展完成"

# 读取扩展后的 PCR 值
print_cmd "tpm2_pcrread sha256:10"
PCR_AFTER_FIRST=$(tpm2_pcrread sha256:10 2>/dev/null)
print_output "$PCR_AFTER_FIRST"

PCR_VALUE_FIRST=$(read_pcr_value 10)
print_separator
print_info "    PCR 值对比:"
print_compare "扩展前" "$PCR_VALUE_INITIAL"
print_compare "扩展后" "$PCR_VALUE_FIRST"
print_success "PCR 值已改变！说明度量数据已被记录"

# ============================================================
# 步骤 4: 模拟文件被篡改
# ============================================================
print_step "4" "模拟配置文件被攻击者篡改"
print_info "攻击者将 SSH 端口从 22 改为 2222（开后门）"

# 修改文件
sed -i 's/ssh_port=22/ssh_port=2222/' config.txt
print_substep "文件已被修改"

# 计算篡改后的哈希
TAMPERED_HASH=$(compute_sha256 config.txt)
print_compare "正常哈希" "$FILE_HASH"
print_compare "篡改哈希" "$TAMPERED_HASH"
print_warning "哈希值不同！文件已被篡改"

# ============================================================
# 步骤 5: 再次度量篡改后的文件
# ============================================================
print_step "5" "对篡改后的文件重新度量"
print_info "将篡改后的哈希扩展到同一个 PCR"

print_cmd "tpm2_pcrextend 10:sha256=${TAMPERED_HASH}"
tpm2_pcrextend "10:sha256=${TAMPERED_HASH}" 2>/dev/null

PCR_VALUE_SECOND=$(read_pcr_value 10)
print_separator
print_info "    PCR 值变化历史:"
print_compare "初始 (全零)" "$PCR_VALUE_INITIAL"
print_compare "第1次度量后" "$PCR_VALUE_FIRST"
print_compare "第2次度量后" "$PCR_VALUE_SECOND"

# ============================================================
# 步骤 6: 验证 PCR 的关键特性
# ============================================================
print_step "6" "验证 PCR 关键安全特性"

echo ""
print_info "    ${BOLD}特性 1: 累积性${NC}"
print_info "    每次扩展都基于前一次的值，形成度量链"
print_info "    PCR = Hash(Hash(0 || H1) || H2)"
echo ""

print_info "    ${BOLD}特性 2: 不可回退${NC}"
print_info "    无法将 PCR 设置回之前的值"
print_info "    即使知道之前的 PCR 值，也无法逆向还原"
echo ""

print_info "    ${BOLD}特性 3: 不可伪造${NC}"
print_info "    攻击者无法在篡改文件后伪造出相同的 PCR 值"
print_info "    因为不同的度量顺序/内容会导致完全不同的 PCR 值"
echo ""

print_info "    ${BOLD}特性 4: 确定性${NC}"
print_info "    相同的度量序列始终产生相同的 PCR 值"
print_info "    这是远程验证的基础"

# --- 清理 ---
print_separator
print_info "度量演示期间，PCR 10 共被扩展了 2 次"
print_info "下一步: bash scripts/03_seal_unseal.sh (数据密封演示)"

print_demo_end "PCR 度量"
