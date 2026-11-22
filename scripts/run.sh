#!/bin/sh
# 在数据仓库中分派主编和执行的定时任务。
ENGINE="$(cd "$(dirname "$0")/.." && pwd)" || exit 2
exec node "$ENGINE/scripts/next.mjs" "$@"
