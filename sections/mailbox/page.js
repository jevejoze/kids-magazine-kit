// 秘密信箱（最后一页）：一句问候 + 今日翻车 + 树洞
// 今日翻车：一位编辑部成员搞砸了一件小事，最后由一位死党说一句，落在和好上
// 树洞：请孩子问一个能难倒某位成员的怪问题，整页只有这一处要动手

export function render(M, kit) {
  const { topBar, foot, ch } = kit;

  const blunder = M.blunder || {
    who: "raccoon",
    title: "土豆发电大断电",
    desc: "捣蛋浣熊说要用发芽土豆给阁楼供电，火花一闪全楼跳闸，咕咕博士的咖啡直接煮成了胡椒袜子味！",
    makeup: "咕咕博士：下回先画电路图，我陪你。",
  };

  const treehole = M.treehole || {
    target: "owl",
    question: M.ask_zh || "问一个博士答不上来的怪问题！",
    hint: "长颈鹿打嗝需要多长时间？",
  };

  const whoSpec = blunder.who || "raccoon";
  const whoId = String(whoSpec).replace(/:.*/, "");
  const whoMood = String(whoSpec).includes(":") ? whoSpec.split(":")[1] : "surprise";

  const targetSpec = treehole.target || "owl";
  const targetId = String(targetSpec).replace(/:.*/, "");
  const targetMood = String(targetSpec).includes(":") ? targetSpec.split(":")[1] : "think";

  const CHAR_NAMES = {
    dog: "团子狗",
    owl: "咕咕博士",
    mouse: "波波鼠",
    raccoon: "捣蛋浣熊",
  };
  const culpritName = CHAR_NAMES[whoId] || whoId;
  const targetName = CHAR_NAMES[targetId] || targetId;

  const culpritAvatar = ch ? ch(`${whoId}:${whoMood}:130`) : "";
  const targetAvatar = ch ? ch(`${targetId}:${targetMood}:110`) : "";

  const hint = treehole.hint ? String(treehole.hint).replace(/^比如[：:，,]?\s*/, "") : "";

  return `${topBar("💌 秘密信箱 · Secret Mailbox", "秘密阁楼")}
  <div class="box note-paper letter fun">
    <div class="tape tape-top"></div>
    <div class="note-tag fun">🤫 阁楼死党悄悄话</div>
    <div class="letter-text fun">${M.hello || M.letter || "早上好！"}</div>
  </div>

  <div class="box note-paper blunder-board fun">
    <div class="tape tape-left"></div>
    <div class="board-head">
      <div class="board-title fun">🙈 今日翻车</div>
      <span class="stamp fun">又翻车啦</span>
    </div>
    <div class="blunder-body">
      <div class="culprit-col">
        <div class="avatar-wrap">${culpritAvatar}</div>
        <div class="culprit-badge fun">翻车的是：${culpritName}</div>
      </div>
      <div class="blunder-text">
        <div class="case-title fun">💥 ${blunder.title}</div>
        <div class="case-desc fun">${blunder.desc}</div>
        ${blunder.makeup ? `<div class="makeup fun">${blunder.makeup}</div>` : ""}
      </div>
    </div>
  </div>

  <div class="box note-paper treehole-board fun">
    <div class="tape tape-right"></div>
    <div class="treehole-title fun">🕳️ 树洞 · 难倒${targetName}</div>
    <div class="treehole-prompt fun">❓ ${treehole.question}</div>
    ${hint ? `<div class="treehole-hint fun">比如：${hint}</div>` : ""}
    <div class="doodle-zone">
      <div class="doodle-tip fun">写一句、画一笔都行</div>
      <div class="target-avatar">${targetAvatar}</div>
    </div>
  </div>

  ${foot((M.send_note || "说给死党听") + " · 明天见！See you tomorrow!")}`;
}
