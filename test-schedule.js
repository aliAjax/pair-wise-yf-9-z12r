// 最小 DOM/localStorage 桩，加载真实 app.js 验证排程状态机
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const store = new Map();
const code = fs.readFileSync("app.js", "utf8");

function boot() {
  const listeners = {};
  function makeEl(id) {
    return {
      id: id || "",
      value: "",
      textContent: "",
      innerHTML: "",
      files: [],
      dataset: {},
      classList: { add() {}, remove() {} },
      addEventListener(type, fn) {
        (listeners[id] ||= []).push({ type, fn });
      },
      closest() {
        return null;
      }
    };
  }
  const ids = [
    "searchInput", "playerFilter", "complexityFilter", "sortMode", "gameForm",
    "nameInput", "minPlayersInput", "maxPlayersInput", "durationInput", "complexityInput",
    "lastPlayedInput", "coverInput", "gameList", "detailView", "gameCount", "ruleCount",
    "staleGame", "visibleCount", "scheduleView", "scheduleStatus"
  ];
  const els = Object.fromEntries(ids.map((id) => [id, makeEl(id)]));
  const documentStub = { querySelector: (sel) => els[sel.replace("#", "")] || makeEl(sel) };
  const sandbox = {
    document: documentStub,
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key)
    },
    console,
    crypto: { randomUUID: () => "id-" + Math.random().toString(36).slice(2, 10) },
    structuredClone: (v) => JSON.parse(JSON.stringify(v)),
    setTimeout,
    Date
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "app.js" });
  const sched = listeners.scheduleView;
  return {
    els,
    change: sched.find((l) => l.type === "change").fn,
    click: sched.find((l) => l.type === "click").fn,
    run: (src) => vm.runInContext(src, sandbox)
  };
}

function readState() {
  return JSON.parse(store.get("zfl18-boardgame-rule-cards"));
}

let app = boot();
let change = app.change;
let click = app.click;

// 模拟 scheduleView 内勾选变更
function pickGame(id, checked) {
  change({
    target: {
      dataset: { pickId: id },
      checked,
      disabled: false,
      closest(sel) {
        return sel === "[data-pick-id]" ? this : null;
      }
    },
    preventDefault() {}
  });
}

function checkItem(itemId, checked) {
  change({
    target: {
      dataset: { itemId },
      checked,
      disabled: false,
      closest(sel) {
        return sel === "[data-item-id]" ? this : null;
      }
    },
    preventDefault() {}
  });
}

function setAvailable(minutes) {
  change({
    target: {
      value: String(minutes),
      closest(sel) {
        return sel === "#planAvailable" ? this : null;
      }
    },
    preventDefault() {}
  });
}

function clickButton(selector) {
  click({
    target: { closest: (sel) => (sel === selector ? true : null) },
    preventDefault() {}
  });
}

// ---------- 场景 1：初始渲染为规划态，重度游戏(盖亚计划)必选 ----------
let st = readState();
assert.strictEqual(st.session, null, "初始无排程");
const heavy = st.games.find((g) => g.complexity === "重");
assert.ok(st.scheduleDraft.selectedIds.includes(heavy.id), "支持4人的重度游戏自动必选");
assert.strictEqual(app.els.scheduleStatus.textContent, "未排程", "状态标签=未排程");
console.log("PASS 初始规划态，重度必选:", st.scheduleDraft.selectedIds.length, "款预选");

// ---------- 场景 2：超时整场拒绝，session 与收藏不变 ----------
setAvailable(5); // 仅重度 9 条已超
const lightIds = readState().games.filter((g) => g.complexity !== "重").map((g) => g.id);
lightIds.forEach((id) => pickGame(id, true));
st = readState();
const snapshotBefore = JSON.stringify(st);
assert.ok(st.scheduleDraft.selectedIds.length >= 1, "至少选中重度游戏");

clickButton("#createSessionBtn");
st = readState();
assert.strictEqual(st.session, null, "超时拒绝：不得生成 session");
assert.strictEqual(JSON.stringify(st), snapshotBefore, "拒绝后状态不变（原排程与收藏不动）");
console.log("PASS 超时整场拒绝，原排程与收藏不变");

// ---------- 场景 3：取消轻量游戏并放宽可用时间，生成排程 ----------
lightIds.forEach((id) => pickGame(id, false));
setAvailable(10);
clickButton("#createSessionBtn");
st = readState();
assert.strictEqual(st.session.status, "active", "生成 active 排程");
const ruleTotal = st.session.games.reduce((n, g) => n + g.items.length, 0);
assert.ok(ruleTotal <= st.session.availableMinutes, "排程总时长在可用分钟内");
assert.ok(st.session.games.some((g) => g.complexity === "重"), "重度游戏在排程内");
console.log(`PASS 生成排程：${st.session.games.length}款 ${ruleTotal}条，可用${st.session.availableMinutes}分钟`);

// ---------- 场景 4：必须逐项勾选完才能结束 ----------
clickButton("#finishSessionBtn");
assert.strictEqual(readState().session.status, "active", "未勾完不能锁定");

for (const game of st.session.games) {
  for (const item of game.items) {
    checkItem(item.id, true);
  }
}
st = readState();
assert.ok(
  st.session.games.every((g) => g.items.every((i) => i.checked)),
  "所有条目勾选状态已持久化"
);
assert.ok(app.els.scheduleStatus.textContent.startsWith("复习中"), "进行中状态标签");
clickButton("#finishSessionBtn");
st = readState();
assert.strictEqual(st.session.status, "locked", "全部勾选后可锁定");
assert.ok(st.session.lockedAt, "锁定时间已记录");
console.log("PASS 逐项勾选后才能结束，记录锁定于", st.session.lockedAt);

// ---------- 场景 5：锁定后收藏新增争议/遗忘点不回写历史 ----------
const lockedSnapshot = JSON.stringify(st.session);
app.run(`
  const g = state.games.find(x => x.complexity === "重");
  g.disputes.push("锁定后新增的争议点");
  g.forgets.push("锁定后新增的遗忘点");
  renderAll();
`);
st = readState();
assert.strictEqual(JSON.stringify(st.session), lockedSnapshot, "历史排程快照未被回写");
assert.ok(st.games.find((g) => g.complexity === "重").disputes.includes("锁定后新增的争议点"), "收藏本身正常更新");
assert.ok(app.els.scheduleStatus.textContent.startsWith("已锁定"), "锁定态状态标签");
console.log("PASS 锁定后新增争议/遗忘点不回写历史");

// ---------- 场景 6：锁定面板上的勾选操作只读 ----------
const itemId = st.session.games[0].items[0].id;
checkItem(itemId, false);
assert.strictEqual(JSON.stringify(readState().session), lockedSnapshot, "锁定后勾选不改变历史");
console.log("PASS 锁定面板操作只读");

// ---------- 场景 7：规划下一场，刷新后草稿恢复 ----------
clickButton("#planNextBtn");
assert.strictEqual(readState().session, null, "规划下一场清空锁定记录");
setAvailable(45);
assert.strictEqual(readState().scheduleDraft.availableMinutes, 45, "草稿已持久化");

app = boot(); // 模拟刷新：localStorage 保留，页面脚本重新执行
change = app.change;
click = app.click;
st = readState();
assert.strictEqual(st.scheduleDraft.availableMinutes, 45, "刷新后草稿恢复");
assert.strictEqual(st.session, null, "刷新后仍是规划态");
console.log("PASS 刷新后恢复页面状态与本地存储同步");

// ---------- 场景 8：进行中排程刷新恢复 ----------
setAvailable(60);
clickButton("#createSessionBtn");
st = readState();
assert.strictEqual(st.session.status, "active");
const before = JSON.stringify(st.session);
const item0 = st.session.games[0].items[0];
app = boot();
change = app.change;
click = app.click;
assert.strictEqual(JSON.stringify(readState().session), before, "进行中排程刷新恢复");
assert.ok(app.els.scheduleStatus.textContent.startsWith("复习中"), "刷新后渲染复习中");
console.log("PASS 复习进度刷新后恢复");

// ---------- 场景 9：人数变化时必选联动（5人局没有可支持的重度游戏，提示且无强制项） ----------
// 当前有进行中排程，先放弃回到规划态
clickButton("#abandonSessionBtn");
assert.strictEqual(readState().session, null, "放弃后回到规划态");
change({
  target: {
    value: "5",
    closest(sel) {
      return sel === "#planPlayerCount" ? this : null;
    }
  },
  preventDefault() {}
});
st = readState();
assert.strictEqual(st.scheduleDraft.playerCount, 5, "人数草稿更新");
assert.strictEqual(st.scheduleDraft.selectedIds.length, 0, "5人局无候选，必选自动清空");
assert.ok(app.els.scheduleView.innerHTML.includes("重度游戏不支持 5 人"), "列出不支持的重度游戏");
console.log("PASS 人数联动：不支持人数的重度游戏被排除并提示");

// 切回 4 人时重度游戏重新自动必选
change({
  target: {
    value: "4",
    closest(sel) {
      return sel === "#planPlayerCount" ? this : null;
    }
  },
  preventDefault() {}
});
assert.ok(
  readState().scheduleDraft.selectedIds.includes(readState().games.find((g) => g.complexity === "重").id),
  "切回4人后重度重新必选"
);
console.log("PASS 人数切回后重度游戏重新自动入选");

// ---------- 场景 10：删除收藏游戏不影响进行中排程的快照 ----------
setAvailable(60);
clickButton("#createSessionBtn");
assert.strictEqual(readState().session.status, "active");
const sessionBefore = JSON.stringify(readState().session);
app.run(`
  const heavyGame = state.games.find(x => x.complexity === "重");
  state.games = state.games.filter(x => x.id !== heavyGame.id);
  renderAll();
`);
assert.strictEqual(JSON.stringify(readState().session), sessionBefore, "删除游戏后排程快照仍完整");
assert.ok(app.els.scheduleStatus.textContent.startsWith("复习中"), "排程仍在进行中");
console.log("PASS 收藏变更（删除游戏）不影响进行中的排程快照");

console.log("\n全部场景通过 ✅");
