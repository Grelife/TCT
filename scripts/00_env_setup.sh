#!/bin/bash
# ============================================================
# 00_env_setup.sh — 环境安装脚本
# 在 Ubuntu 22.04 上安装 TPM 2.0 模拟器和工具链
# 用法: sudo bash scripts/00_env_setup.sh
# ============================================================

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/colors.sh"

print_banner "${ICON_GEAR} TPM 2.0 环境安装"

# --- 检查权限 ---
if [ "$EUID" -ne 0 ]; then
    print_error "请使用 sudo 运行此脚本！"
    print_cmd "sudo bash scripts/00_env_setup.sh"
    exit 1
fi

# --- 检查系统 ---
print_step "1" "检查操作系统"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    print_substep "系统: ${NAME} ${VERSION}"
    if [[ "$ID" != "ubuntu" ]]; then
        print_warning "本脚本针对 Ubuntu 22.04 编写，其他发行版可能需要调整"
    fi
else
    print_warning "无法检测操作系统版本"
fi

# --- 更新包索引 ---
print_step "2" "更新软件包索引"
print_cmd "apt-get update"
apt-get update -qq
print_success "包索引已更新"

# --- 安装核心依赖 ---
print_step "3" "安装 TPM 2.0 软件栈"

PACKAGES=(
    # TPM 2.0 模拟器
    "swtpm"
    "swtpm-tools"
    # TPM 2.0 工具链
    "tpm2-tools"
    "libtss2-dev"
    # TPM 2.0 资源管理器 (解决 PKCS#11 等高级工具的内存管理问题)
    "tpm2-abrmd"
    "libtss2-tcti-tabrmd0"
    "libtss2-tcti-tabrmd-dev"
    # TPM 2.0 PKCS#11
    "libtpm2-pkcs11-1"
    "libtpm2-pkcs11-tools"
    # 加密工具
    "openssl"
    # PKCS#11 工具
    "opensc"
    "gnutls-bin"
    "libengine-pkcs11-openssl"
    # 其他工具
    "xxd"
    "jq"
    # D-Bus (资源管理器依赖)
    "dbus"
)

for pkg in "${PACKAGES[@]}"; do
    print_substep "安装 ${pkg}..."
    if dpkg -l "$pkg" &>/dev/null; then
        print_info "  ${pkg} 已安装，跳过"
    else
        if apt-get install -y -qq "$pkg" &>/dev/null; then
            print_success "  ${pkg} 安装成功"
        else
            print_warning "  ${pkg} 安装失败（可能在此版本不可用，继续...）"
        fi
    fi
done

# --- 验证安装 ---
print_step "4" "验证安装结果"

TOOLS=("swtpm" "tpm2_pcrread" "tpm2_createprimary" "tpm2_quote" "openssl" "pkcs11-tool")
all_ok=true

for tool in "${TOOLS[@]}"; do
    if command -v "$tool" &>/dev/null; then
        version=$($tool --version 2>/dev/null | head -1 || echo "已安装")
        print_substep "${tool}: ${version}"
    else
        print_warning "${tool} 未找到"
        all_ok=false
    fi
done

# 检查 tpm2_ptool (Python 工具)
if command -v tpm2_ptool &>/dev/null; then
    print_substep "tpm2_ptool: 已安装"
else
    print_warning "tpm2_ptool 未找到 (PKCS#11 演示可能受影响)"
    print_info "尝试通过 pip 安装..."
    pip3 install tpm2-pkcs11-tools 2>/dev/null || print_warning "pip 安装失败，PKCS#11 演示可能需要手动配置"
fi

# --- 检查 PKCS#11 模块 ---
print_step "5" "检查 PKCS#11 模块"
PKCS11_PATHS=(
    "/usr/lib/x86_64-linux-gnu/libtpm2_pkcs11.so"
    "/usr/lib/libtpm2_pkcs11.so"
    "/usr/local/lib/libtpm2_pkcs11.so"
)
pkcs11_found=false
for p in "${PKCS11_PATHS[@]}"; do
    if [ -f "$p" ]; then
        print_substep "PKCS#11 模块: ${p}"
        pkcs11_found=true
        break
    fi
done
if [ "$pkcs11_found" = false ]; then
    print_warning "PKCS#11 模块未找到，PKCS#11 演示可能受影响"
fi

# --- 完成 ---
print_separator
if [ "$all_ok" = true ]; then
    print_success "所有核心组件安装完成！"
else
    print_warning "部分组件安装失败，请检查上方输出"
fi

print_info "下一步: bash scripts/01_start_tpm.sh (启动 TPM 模拟器)"
print_demo_end "环境安装"
