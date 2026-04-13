#!/bin/bash
# ============================================================
# 05_pkcs11.sh — PKCS#11 接口演示
# 演示 TPM 作为标准密码令牌的能力
#
# ⚠️ 重要：PKCS#11 操作必须通过资源管理器 (tpm2-abrmd)
# 因为 tpm2_ptool 底层会在单条命令内并发占用超过 3 个瞬态内存插槽
# 没有资源管理器自动换页就必定 OOM (0x902)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/utils/tpm_helpers.sh"

print_banner "${ICON_KEY} 演示 4: PKCS#11 接口"

# --- 前置检查 ---
check_environment
setup_work_dir "pkcs11"

# --- 检查 PKCS#11 工具 ---
print_step "0" "检查 PKCS#11 工具和资源管理器"
PKCS11_LIB=""
for p in /usr/lib/x86_64-linux-gnu/pkcs11/libtpm2_pkcs11.so /usr/lib/x86_64-linux-gnu/libtpm2_pkcs11.so /usr/lib/libtpm2_pkcs11.so /usr/local/lib/libtpm2_pkcs11.so; do
    [ -f "$p" ] && PKCS11_LIB="$p" && break
done
[ -z "$PKCS11_LIB" ] && { print_error "libtpm2_pkcs11.so 未找到"; exit 1; }
print_substep "PKCS#11 模块: ${PKCS11_LIB}"
command -v tpm2_ptool &>/dev/null || { print_error "tpm2_ptool 未安装"; exit 1; }

# 检查资源管理器
command -v tpm2-abrmd &>/dev/null || { print_error "tpm2-abrmd 未安装，请运行: sudo apt install -y tpm2-abrmd libtss2-tcti-tabrmd0"; exit 1; }

# 检查是否在 dbus-run-session 中运行
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
    print_error "请在 dbus-run-session 子终端中运行此脚本！"
    print_info "用法: dbus-run-session bash"
    print_info "然后: tpm2-abrmd --tcti=\"swtpm:host=localhost,port=2321\" --session &"
    print_info "然后: export TPM2TOOLS_TCTI=\"tabrmd:bus_type=session\""
    print_info "最后: bash scripts/05_pkcs11.sh"
    exit 1
fi

# 检查 tpm2-abrmd 是否在运行
if ! pgrep -x "tpm2-abrmd" > /dev/null 2>&1; then
    print_info "正在启动资源管理器 tpm2-abrmd..."
    tpm2-abrmd --tcti="swtpm:host=localhost,port=${TPM_SERVER_PORT}" --session &
    sleep 2
    if pgrep -x "tpm2-abrmd" > /dev/null 2>&1; then
        print_success "资源管理器已启动"
    else
        print_error "资源管理器启动失败"
        exit 1
    fi
else
    print_substep "资源管理器 tpm2-abrmd 已在运行"
fi

# 切换 TCTI 到资源管理器
export TPM2TOOLS_TCTI="tabrmd:bus_type=session"
export TPM2_PKCS11_TCTI="tabrmd:bus_type=session"
print_substep "TCTI 已切换到: tabrmd:bus_type=session"

print_success "PKCS#11 工具和资源管理器检查通过"

# --- 步骤 1: 初始化 Token Store ---
print_step "1" "初始化 PKCS#11 Token Store"
mkdir -p "${TPM2_PKCS11_STORE}"
rm -rf "${TPM2_PKCS11_STORE}"/*
print_cmd "tpm2_ptool init"
tpm2_ptool init 2>/dev/null || print_warning "Store 可能已初始化"

# --- 步骤 2: 创建 Token ---
print_step "2" "创建 PKCS#11 Token"
print_info "Token 类似虚拟智能卡，有 SO PIN 和 User PIN"
print_cmd "tpm2_ptool addtoken --pid=1 --label=${PKCS11_TOKEN_LABEL} --sopin=${PKCS11_SO_PIN} --userpin=${PKCS11_USER_PIN}"
tpm2_ptool addtoken --pid=1 --label="${PKCS11_TOKEN_LABEL}" --sopin="${PKCS11_SO_PIN}" --userpin="${PKCS11_USER_PIN}" 2>/dev/null
print_success "Token '${PKCS11_TOKEN_LABEL}' 已创建"

# --- 步骤 3: 生成密钥对 ---
print_step "3" "在 TPM Token 中生成 RSA-2048 密钥对"
print_info "私钥在 TPM 内部生成，永远不会离开 TPM"
print_cmd "tpm2_ptool addkey --label=${PKCS11_TOKEN_LABEL} --userpin=${PKCS11_USER_PIN} --algorithm=rsa2048"
tpm2_ptool addkey --label="${PKCS11_TOKEN_LABEL}" --userpin="${PKCS11_USER_PIN}" --algorithm=rsa2048 2>/dev/null
print_success "RSA-2048 密钥对已生成"

# --- 步骤 4: 列出 Token 信息 ---
print_step "4" "查看 PKCS#11 Slot 和 Token"
if command -v pkcs11-tool &>/dev/null; then
    print_cmd "pkcs11-tool --module ${PKCS11_LIB} -L"
    pkcs11-tool --module "${PKCS11_LIB}" -L 2>/dev/null | head -20 | while IFS= read -r line; do print_output "$line"; done
    echo ""
    print_cmd "pkcs11-tool --module ${PKCS11_LIB} -O --login --pin ${PKCS11_USER_PIN}"
    pkcs11-tool --module "${PKCS11_LIB}" -O --login --pin "${PKCS11_USER_PIN}" 2>/dev/null | head -30 | while IFS= read -r line; do print_output "$line"; done
else
    print_warning "pkcs11-tool 不可用，使用 tpm2_ptool"
    tpm2_ptool listtokens 2>/dev/null || true
fi

# --- 步骤 5: 数字签名 ---
print_step "5" "使用 TPM 密钥进行数字签名"
SIGN_DATA="TPM PKCS#11 Signature Demo - $(date)"
echo -n "$SIGN_DATA" > data_to_sign.txt
print_substep "待签名: ${SIGN_DATA}"

if command -v pkcs11-tool &>/dev/null; then
    print_cmd "pkcs11-tool --module ${PKCS11_LIB} --sign --mechanism SHA256-RSA-PKCS --login --pin ${PKCS11_USER_PIN} -i data_to_sign.txt -o signature.bin"
    if pkcs11-tool --module "${PKCS11_LIB}" --sign --mechanism SHA256-RSA-PKCS --login --pin "${PKCS11_USER_PIN}" -i data_to_sign.txt -o signature.bin 2>/dev/null; then
        print_success "签名成功！($(wc -c < signature.bin) 字节)"

        # 步骤 6: 验证签名
        print_step "6" "导出公钥并验证签名"
        if pkcs11-tool --module "${PKCS11_LIB}" --read-object --type pubkey --login --pin "${PKCS11_USER_PIN}" -o pubkey.der 2>/dev/null; then
            openssl rsa -pubin -inform DER -in pubkey.der -outform PEM -out pubkey.pem 2>/dev/null
            print_substep "公钥已导出"
            VERIFY=$(openssl dgst -sha256 -verify pubkey.pem -signature signature.bin data_to_sign.txt 2>&1)
            if echo "$VERIFY" | grep -q "Verified OK"; then
                print_success "${ICON_SHIELD} 签名验证成功！(Verified OK)"
            else
                print_warning "验证结果: ${VERIFY}"
            fi
        else
            print_warning "无法导出公钥，跳过验证"
        fi
    else
        print_warning "签名失败，可能需要调整 PKCS#11 配置"
    fi
else
    print_warning "pkcs11-tool 不可用，跳过签名演示"
fi

# --- 总结 ---
print_step "7" "PKCS#11 总结"
echo ""
print_info "    PKCS#11 的意义:"
print_info "    • 标准化接口 — 应用无需关心底层硬件"
print_info "    • 密钥保护 — 私钥在 TPM 中,永不导出"
print_info "    • 广泛兼容 — Firefox/Chrome/OpenSSL 均支持"
echo ""
print_info "    为什么需要资源管理器 (tpm2-abrmd):"
print_info "    • tpm2_ptool 在单条命令内并发占用 >3 个瞬态插槽"
print_info "    • 资源管理器自动进行上下文换页调度"
print_info "    • 实验 1-3 可直连 swtpm，实验 4 必须经 abrmd 代理"
echo ""

flush_all_contexts
print_info "下一步: bash scripts/06_full_demo.sh"
print_demo_end "PKCS#11 接口"
