#!/bin/bash
# ============================================================
# TPM 操作辅助函数
# 封装常用的 TPM 操作，简化演示脚本
# ============================================================

# 获取脚本所在目录，加载配置
HELPERS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$HELPERS_DIR")"

# 加载配置文件
source "${SCRIPTS_DIR}/../config/tpm_env.conf"
# 加载颜色工具
source "${HELPERS_DIR}/colors.sh"

# --- 环境检查函数 ---

# 检查 TPM 模拟器是否在运行
check_tpm_running() {
    if pgrep -x "swtpm" > /dev/null 2>&1; then
        return 0
    else
        print_error "TPM 模拟器 (swtpm) 未在运行！"
        print_info "请先运行: bash scripts/01_start_tpm.sh"
        return 1
    fi
}

# 检查 tpm2-tools 是否已安装
check_tpm2_tools() {
    if command -v tpm2_pcrread &> /dev/null; then
        return 0
    else
        print_error "tpm2-tools 未安装！"
        print_info "请先运行: sudo bash scripts/00_env_setup.sh"
        return 1
    fi
}

# 综合环境检查
check_environment() {
    print_info "检查运行环境..."

    if ! check_tpm2_tools; then
        exit 1
    fi
    print_substep "tpm2-tools 已安装 ✓"

    if ! check_tpm_running; then
        exit 1
    fi
    print_substep "swtpm 模拟器运行中 ✓"

    # 测试连接
    if tpm2_pcrread sha256:0 &> /dev/null; then
        print_substep "TPM 连接正常 ✓"
    else
        print_error "无法连接到 TPM 模拟器！"
        print_info "TCTI 配置: ${TPM2TOOLS_TCTI}"
        exit 1
    fi

    print_success "环境检查通过"
}

# --- 工作目录管理 ---

# 创建并进入工作子目录
setup_work_dir() {
    local sub_dir="$1"
    local work_path="${TPM_WORK_DIR}/${sub_dir}"
    mkdir -p "$work_path"
    cd "$work_path" || exit 1
    print_substep "工作目录: ${work_path}"
}

# 清理工作子目录
cleanup_work_dir() {
    local sub_dir="$1"
    local work_path="${TPM_WORK_DIR}/${sub_dir}"
    if [ -d "$work_path" ]; then
        rm -rf "$work_path"
    fi
}

# --- TPM 操作辅助 ---

# 清除所有 TPM 上下文（释放资源）
flush_all_contexts() {
    tpm2_flushcontext -t 2>/dev/null || true
    tpm2_flushcontext -l 2>/dev/null || true
    tpm2_flushcontext -s 2>/dev/null || true
}

# 读取指定 PCR 值并格式化输出
read_pcr_value() {
    local pcr_index="$1"
    local hash_algo="${2:-sha256}"
    tpm2_pcrread "${hash_algo}:${pcr_index}" 2>/dev/null | grep -A1 "${pcr_index}" | tail -1 | tr -d ' '
}

# 读取多个 PCR 值
read_pcr_values() {
    local pcr_list="$1"  # 例如 "0,1,2,3"
    local hash_algo="${2:-sha256}"
    tpm2_pcrread "${hash_algo}:${pcr_list}" 2>/dev/null
}

# 创建主密钥 (Primary Key) 并保存上下文
create_primary_key() {
    local ctx_file="${1:-primary.ctx}"
    local hierarchy="${2:-o}"  # o=owner, e=endorsement, p=platform
    flush_all_contexts
    tpm2_createprimary -C "$hierarchy" -g sha256 -G rsa -c "$ctx_file" 2>/dev/null
    if [ $? -eq 0 ]; then
        print_substep "主密钥已创建: ${ctx_file}"
        return 0
    else
        print_error "创建主密钥失败"
        return 1
    fi
}

# 计算文件的 SHA-256 哈希值
compute_sha256() {
    local file="$1"
    sha256sum "$file" | awk '{print $1}'
}

# 安全地执行 TPM 命令，带错误处理
tpm_exec() {
    local description="$1"
    shift
    local cmd="$*"

    print_cmd "$cmd"
    local output
    output=$(eval "$cmd" 2>&1)
    local ret=$?

    if [ $ret -eq 0 ]; then
        if [ -n "$output" ]; then
            print_output "$output"
        fi
        return 0
    else
        print_error "${description} 失败 (退出码: ${ret})"
        if [ -n "$output" ]; then
            print_output "$output"
        fi
        return $ret
    fi
}
