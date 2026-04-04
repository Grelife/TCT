#!/bin/bash
# ============================================================
# 01_start_tpm.sh — 启动 TPM 2.0 软件模拟器
# 使用 swtpm 在 TCP 模式下运行 TPM 2.0 模拟器
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/tpm_helpers.sh"

print_banner "${ICON_ROCKET} 启动 TPM 2.0 模拟器"

# --- 检查是否已在运行 ---
print_step "1" "检查现有实例"
if pgrep -x "swtpm" > /dev/null 2>&1; then
    print_warning "swtpm 已在运行中 (PID: $(pgrep -x swtpm))"
    print_substep "停止现有实例..."
    pkill -x swtpm 2>/dev/null || true
    sleep 1
    print_substep "已停止"
fi

# --- 创建状态目录 ---
print_step "2" "准备 TPM 状态目录"
mkdir -p "${TPM_STATE_DIR}"
mkdir -p "${TPM_WORK_DIR}"
print_substep "状态目录: ${TPM_STATE_DIR}"
print_substep "工作目录: ${TPM_WORK_DIR}"

# --- 启动 swtpm ---
print_step "3" "启动 swtpm 模拟器"
print_cmd "swtpm socket --tpmstate dir=${TPM_STATE_DIR} --tpm2 --ctrl type=tcp,port=${TPM_CTRL_PORT} --server type=tcp,port=${TPM_SERVER_PORT} --flags not-need-init,startup-clear"

swtpm socket \
    --tpmstate dir="${TPM_STATE_DIR}" \
    --tpm2 \
    --ctrl type=tcp,port=${TPM_CTRL_PORT} \
    --server type=tcp,port=${TPM_SERVER_PORT} \
    --flags not-need-init,startup-clear &

SWTPM_PID=$!
sleep 2

# --- 验证运行状态 ---
print_step "4" "验证模拟器状态"
if kill -0 $SWTPM_PID 2>/dev/null; then
    print_success "swtpm 已启动 (PID: ${SWTPM_PID})"
    print_substep "服务端口: ${TPM_SERVER_PORT}"
    print_substep "控制端口: ${TPM_CTRL_PORT}"
else
    print_error "swtpm 启动失败！"
    exit 1
fi

# --- 测试 TPM 连接 ---
print_step "5" "测试 TPM 连接"
print_substep "TCTI: ${TPM2TOOLS_TCTI}"

# 执行 TPM2_Startup
print_cmd "tpm2_startup -c"
if tpm2_startup -c 2>/dev/null; then
    print_substep "TPM2_Startup(CLEAR) 成功"
else
    print_substep "TPM2_Startup 已由 swtpm 自动完成"
fi

# 测试读取 PCR
print_cmd "tpm2_pcrread sha256:0"
PCR_OUTPUT=$(tpm2_pcrread sha256:0 2>/dev/null)
if [ $? -eq 0 ]; then
    print_success "TPM 连接测试成功！"
    print_output "$PCR_OUTPUT"
else
    print_error "无法读取 PCR，请检查配置"
    exit 1
fi

# --- 显示配置摘要 ---
print_separator
print_info "TPM 模拟器配置摘要:"
print_compare "PID" "$SWTPM_PID"
print_compare "服务端口" "$TPM_SERVER_PORT"
print_compare "控制端口" "$TPM_CTRL_PORT"
print_compare "TCTI" "$TPM2TOOLS_TCTI"
print_compare "状态目录" "$TPM_STATE_DIR"

print_separator
print_warning "swtpm 在后台运行，关闭终端前请运行 scripts/99_cleanup.sh"
print_info "下一步: bash scripts/02_measurement.sh (PCR 度量演示)"

print_demo_end "TPM 模拟器启动"
