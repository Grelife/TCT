#!/bin/bash
# ============================================================
# 终端彩色输出工具
# 用于美化演示脚本的输出效果
# ============================================================

# --- 颜色定义 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'  # 恢复默认颜色

BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'

# --- 图标定义 ---
ICON_OK="✅"
ICON_FAIL="❌"
ICON_WARN="⚠️"
ICON_INFO="ℹ️"
ICON_KEY="🔑"
ICON_LOCK="🔒"
ICON_UNLOCK="🔓"
ICON_SHIELD="🛡️"
ICON_MEASURE="📏"
ICON_REPORT="📋"
ICON_ROCKET="🚀"
ICON_GEAR="⚙️"

# --- 输出函数 ---

# 打印大标题 (用于每个演示脚本的开头)
print_banner() {
    local title="$1"
    local width=60
    echo ""
    echo -e "${CYAN}$(printf '═%.0s' $(seq 1 $width))${NC}"
    echo -e "${CYAN}║${NC} ${BOLD}${WHITE}${title}${NC}"
    echo -e "${CYAN}$(printf '═%.0s' $(seq 1 $width))${NC}"
    echo ""
}

# 打印步骤标题
print_step() {
    local step_num="$1"
    local title="$2"
    echo ""
    echo -e "  ${BLUE}${BOLD}[步骤 ${step_num}]${NC} ${WHITE}${title}${NC}"
    echo -e "  ${GRAY}$(printf '─%.0s' $(seq 1 50))${NC}"
}

# 打印子步骤
print_substep() {
    local msg="$1"
    echo -e "    ${CYAN}▸${NC} ${msg}"
}

# 打印成功信息
print_success() {
    local msg="$1"
    echo -e "  ${GREEN}${ICON_OK} ${msg}${NC}"
}

# 打印错误信息
print_error() {
    local msg="$1"
    echo -e "  ${RED}${ICON_FAIL} ${msg}${NC}"
}

# 打印警告信息
print_warning() {
    local msg="$1"
    echo -e "  ${YELLOW}${ICON_WARN}  ${msg}${NC}"
}

# 打印普通信息
print_info() {
    local msg="$1"
    echo -e "  ${GRAY}${ICON_INFO}  ${msg}${NC}"
}

# 打印命令 (显示将要执行什么)
print_cmd() {
    local cmd="$1"
    echo -e "    ${DIM}${GRAY}\$ ${cmd}${NC}"
}

# 打印命令输出 (缩进显示)
print_output() {
    local output="$1"
    echo "$output" | while IFS= read -r line; do
        echo -e "    ${GRAY}│${NC} ${line}"
    done
}

# 打印对比 (用于显示前后差异)
print_compare() {
    local label="$1"
    local value="$2"
    echo -e "    ${PURPLE}${label}:${NC} ${WHITE}${value}${NC}"
}

# 打印分隔线
print_separator() {
    echo ""
    echo -e "  ${GRAY}$(printf '· %.0s' $(seq 1 25))${NC}"
    echo ""
}

# 等待用户按回车继续 (用于演示暂停)
wait_for_enter() {
    local msg="${1:-按回车键继续...}"
    echo ""
    echo -e "  ${YELLOW}${BOLD}⏸  ${msg}${NC}"
    read -r
}

# 打印演示结束
print_demo_end() {
    local title="$1"
    echo ""
    echo -e "  ${GREEN}${BOLD}════════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD}  ${ICON_OK} ${title} 演示完成！${NC}"
    echo -e "  ${GREEN}${BOLD}════════════════════════════════════════${NC}"
    echo ""
}
