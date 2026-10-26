#!/bin/sh
# 数据目录（一个私有 git 仓库）的同步：开工前拉最新、认领步骤、做完一步就提交推送。
# 在数据目录里运行：
#   sh <引擎>/scripts/sync.sh start                    拉最新，打印最新一期的进度和谁在做什么
#   sh <引擎>/scripts/sync.sh claim <期号> <步骤> <agent>  认领一步，推送后别的 agent 就看得到
#   sh <引擎>/scripts/sync.sh done  <期号> <步骤> [说明]   这一步做完：去掉认领，提交并推送
#   sh <引擎>/scripts/sync.sh push  "<说明>"             提交并推送其余改动（档案、反馈、随手记）
#   sh <引擎>/scripts/sync.sh check                    有没提交或没推送的改动时返回 1
ENGINE="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "当前目录不在数据仓库里"; exit 2; }
cd "$DATA" || exit 2

pull() { git pull -q --rebase --autostash || { echo "拉取失败：先解决冲突（git status），再继续"; exit 2; }; }

publish() {
  git add -A
  git diff --cached --quiet || git commit -q -m "$1" || exit 2
  pull
  git push -q || { echo "推送失败：检查网络和仓库权限后重跑"; exit 2; }
  echo "已推送：$1"
}

# 期号 7 / 007 / issues/007 → 007；步骤 10 / 10-cover → 10-cover
issue_id() { printf "%03d" "$(basename "$1" | sed 's/^0*//')"; }
stage_id() {
  f=$(ls "$ENGINE/pipeline/stages/" | grep -E "^$(printf %02d "$(echo "$1" | sed 's/-.*//; s/^0*//')")-" | head -1)
  [ -n "$f" ] || { echo "没有这一步：$1"; exit 2; }
  echo "${f%.md}"
}

latest_issue() { ls -d issues/[0-9][0-9][0-9] 2>/dev/null | sort | tail -1; }

case "$1" in
  start)
    pull
    git -C "$ENGINE" pull -q --ff-only 2>/dev/null
    changes=$(git status --porcelain | wc -l | tr -d ' ')
    [ "$changes" = 0 ] || echo "⚠️  本机有 $changes 个文件没提交，确认后用 sync.sh push 推上去"
    issue=$(latest_issue)
    [ -n "$issue" ] || { echo "还没有任何一期"; exit 0; }
    echo "数据仓库已更新到最新（$(git log -1 --format='%h %s')）"
    echo "最新一期：$issue"
    node "$ENGINE/scripts/pipeline.mjs" status "$issue"
    ;;
  claim)
    [ -n "$4" ] || { echo "用法：sync.sh claim <期号> <步骤> <agent>"; exit 2; }
    n=$(issue_id "$2"); s=$(stage_id "$3")
    pull
    f="issues/$n/_claims/$s"
    if [ -f "$f" ]; then echo "第 $s 步已经有人认领：$(cat "$f")"; exit 1; fi
    mkdir -p "issues/$n/_claims"
    echo "$4 $(date -u +%Y-%m-%dT%H:%MZ)" > "$f"
    git add "$f" && git commit -q -m "$n: $4 认领 $s" && git push -q \
      || { git reset -q --hard HEAD~1; echo "认领没推上去，可能别人刚认领了：重跑 sync.sh start 看看"; exit 1; }
    echo "已认领 $n / $s"
    ;;
  done)
    [ -n "$3" ] || { echo "用法：sync.sh done <期号> <步骤> [说明]"; exit 2; }
    n=$(issue_id "$2"); s=$(stage_id "$3")
    rm -f "issues/$n/_claims/$s"
    publish "$n: 完成 $s${4:+ · $4}"
    ;;
  push)
    [ -n "$2" ] || { echo "用法：sync.sh push \"<说明>\""; exit 2; }
    publish "$2"
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
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
