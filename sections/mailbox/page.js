// 秘密信箱（最后一页）：读者秘密树洞 + 脑洞吐槽
// 栏目 1：编辑部翻车公开处刑台（丢人事迹爆料与死党吐槽）
// 栏目 2：秘密树洞 / 向角色提一个答不上来的反套路蠢问题

export function render(M, kit) {
  const { topBar, foot, ch } = kit;

  const blunder = M.blunder || {
    who: "raccoon",
    title: "土豆发电大断电",
    desc: "捣蛋浣熊说要用发芽土豆给阁楼供电，火花一闪全楼跳闸，咕咕博士的咖啡直接煮成了胡椒袜子味！",
  };

  const treehole = M.treehole || {
    target: "owl",
    question: M.ask_zh || "向博士提一个他绝对答不上来的蠢问题！",
    hint: "比如：长颈鹿打嗝需要多长时间？在便签画出你的反套路脑洞！",
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

  return `${topBar("💌 秘密信箱 · Secret Mailbox", "秘密阁楼")}
  <div class="box note-paper letter fun">
    <div class="tape tape-top"></div>
    <div class="note-tag fun">🤫 阁楼死党悄悄话</div>
    <div class="letter-text fun">${M.hello || M.letter || "小满早上好！欢迎来到本期秘密阁楼！"}</div>
  </div>

  <div class="box note-paper blunder-board fun">
    <div class="tape tape-left"></div>
    <div class="board-head">
      <div class="board-title fun">🚨 本周翻车公开处刑台</div>
      <span class="stamp fun">处刑通报</span>
    </div>
    <div class="blunder-body">
      <div class="culprit-col">
        <div class="avatar-wrap">${culpritAvatar}</div>
        <div class="culprit-badge fun">责任人：${culpritName}</div>
      </div>
      <div class="blunder-text">
        <div class="case-title fun">💥 案件：${blunder.title}</div>
        <div class="case-desc fun">${blunder.desc}</div>
        <div class="verdict fun">丢人指数：⭐⭐⭐⭐⭐ · 死党一致判定：绝不原谅（下次还敢）</div>
      </div>
    </div>
  </div>

  <div class="box note-paper treehole-board fun">
    <div class="tape tape-right"></div>
    <div class="treehole-head">
      <div class="treehole-title fun">🕳️ 秘密树洞 · 向${targetName}提问</div>
      <span class="anti-tag fun">反套路挑战</span>
    </div>
    <div class="treehole-prompt fun">❓ ${treehole.question}</div>
    ${treehole.hint ? `<div class="treehole-hint fun">💡 <b>反套路脑洞示范：</b>${treehole.hint}</div>` : ""}
    <div class="doodle-zone">
      <div class="doodle-header fun">
        <span>✏️ 涂鸦草稿区 / 便签写画留言：</span>
        <span class="doodle-target en">Target: ${targetId}</span>
      </div>
      <div class="doodle-canvas">
        <div class="doodle-grid">
          <i></i><i></i><i></i>
        </div>
        <div class="doodle-tip fun">在这里写下或画出你的反套路问题，绝对难倒他！</div>
        <div class="target-avatar">${targetAvatar}</div>
      </div>
    </div>
  </div>

  ${foot((M.send_note || "说给死党听") + " · 明天见！See you tomorrow!")}`;
}
