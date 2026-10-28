#!/bin/sh
# 数据目录（一个私有 git 仓库）的同步：开工前拉最新，一期做完提交推送一次。
# 在数据目录里运行：
#   sh <引擎>/scripts/sync.sh start           拉最新，打印最新一期的进度
#   sh <引擎>/scripts/sync.sh push "<说明>"    提交并推送（出完一期、改了档案、反馈、随手记）
#   sh <引擎>/scripts/sync.sh check           有没提交或没推送的改动时返回 1
# 渲染图、语音、视频这些产物由数据目录的 .gitignore 挡在 git 外面，成品放网盘。
ENGINE="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "当前目录不在数据仓库里"; exit 2; }
cd "$DATA" || exit 2

pull() { git pull -q --rebase --autostash || { echo "拉取失败：先解决冲突（git status），再继续"; exit 2; }; }

latest_issue() { ls -d issues/[0-9][0-9][0-9] 2>/dev/null | sort | tail -1; }

case "$1" in
  start)
    pull
    changes=$(git status --porcelain | wc -l | tr -d ' ')
    [ "$changes" = 0 ] || echo "⚠️  本机有 $changes 个文件没提交"
    issue=$(latest_issue)
    [ -n "$issue" ] || { echo "还没有任何一期"; exit 0; }
    echo "数据仓库已更新到最新（$(git log -1 --format='%h %s')）"
    echo "最新一期：$issue"
    node "$ENGINE/scripts/pipeline.mjs" status "$issue"
    ;;
  push)
    [ -n "$2" ] || { echo "用法：sync.sh push \"<说明>\""; exit 2; }
    git add -A
    git diff --cached --quiet || git commit -q -m "$2" || exit 2
    pull
    git push -q || { echo "推送失败：检查网络和仓库权限后重跑"; exit 2; }
    echo "已推送：$2"
    ;;
  check)
    git fetch -q 2>/dev/null
    dirty=$(git status --porcelain | wc -l | tr -d ' ')
    ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
    [ "$dirty" = 0 ] && [ "$ahead" = 0 ] && exit 0
    echo "数据仓库还有 $dirty 个文件没提交、$ahead 个提交没推送"
    exit 1
    ;;
  *)
    sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
