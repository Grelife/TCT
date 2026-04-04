#!/bin/bash
# ============================================================
# 99_cleanup.sh — 环境清理脚本
# 停止 TPM 模拟器并清理临时文件
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/colors.sh"
source "${SCRIPT_DIR}/../config/tpm_env.conf"

print_banner "${ICON_GEAR} 清理 TPM 环境"

# --- 停止 swtpm ---
print_step "1" "停止 TPM 模拟器"
if pgrep -x "swtpm" > /dev/null 2>&1; then
    PIDS=$(pgrep -x swtpm)
    print_substep "发现 swtpm 进程: ${PIDS}"
    pkill -x swtpm 2>/dev/null || true
    sleep 1
    if pgrep -x "swtpm" > /dev/null 2>&1; then
        print_warning "swtpm 未正常停止，强制终止..."
        pkill -9 -x swtpm 2>/dev/null || true
    fi
    print_success "swtpm 已停止"
else
    print_info "swtpm 未在运行"
fi

# --- 清理临时文件 ---
print_step "2" "清理临时文件"

if [ -d "${TPM_STATE_DIR}" ]; then
    rm -rf "${TPM_STATE_DIR}"
    print_substep "已删除: ${TPM_STATE_DIR}"
fi

if [ -d "${TPM_WORK_DIR}" ]; then
    rm -rf "${TPM_WORK_DIR}"
    print_substep "已删除: ${TPM_WORK_DIR}"
fi

# 清理 PKCS#11 store
if [ -d "${TPM2_PKCS11_STORE}" ]; then
    rm -rf "${TPM2_PKCS11_STORE}"
    print_substep "已删除 PKCS#11 store"
fi

print_success "临时文件已清理"

# --- 完成 ---
print_separator
print_success "环境已完全清理"
print_info "如需重新开始，请运行: bash scripts/01_start_tpm.sh"
print_demo_end "环境清理"
