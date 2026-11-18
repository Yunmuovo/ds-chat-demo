#!/usr/bin/env bash
# 构建并部署到手机存储，直接双击 index.html 使用（file:// 打开，无需服务器）
# 用法: bash build.sh [目标目录]
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

TARGET="${1:-/sdcard/Download/DSH-Go/chat-demo}"

[ -d node_modules ] || pnpm install --frozen-lockfile
pnpm type
pnpm build

rm -rf "$TARGET"
mkdir -p "$TARGET"
cp -a dist/. "$TARGET"/

echo "已部署到 $TARGET"
echo "已同步到 $ROOT/docs"
echo "文件数: $(find "$TARGET" -type f | wc -l)  大小: $(du -sh "$TARGET" | cut -f1)"
echo "打开: file://$TARGET/index.html"
