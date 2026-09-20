const storageKey = "zfl18-boardgame-rule-cards";
// 每条规则卡片的复习估算时长（分钟），用于排程容量校验
const reviewMinutesPerRule = 1;
const ruleTypeMeta = [
  { key: "forgets", title: "容易忘的规则" },
  { key: "disputes", title: "常见争议" },
  { key: "setup", title: "开局准备" },
  { key: "scoring", title: "计分提醒" }
];
const today = new Date();

const defaultState = {
  selectedId: "",
  // 规划表单草稿：人数、可用分钟、勾选的游戏 id（刷新后恢复）
  scheduleDraft: { playerCount: 4, availableMinutes: 30, selectedIds: [] },
  // 排程：复习中为 active，结束后 status 变 locked
  session: null,
  games: [
    {
      id: crypto.randomUUID(),
      name: "奥尔良",
      minPlayers: 2,
      maxPlayers: 4,
      duration: 90,
      complexity: "中",
      lastPlayed: "2025-11-20",
      cover: "",
      forgets: ["商站建造前先确认道路或水路连接", "袋中随从抽完后不是重洗弃堆，而是从已回袋内容继续抽"],
      disputes: ["事件顺序和玩家动作结算先后", "科技板是否能替代所有同类随从"],
      setup: ["按人数放置货物板块", "每位玩家拿起始随从、商人和个人板"],
      scoring: ["货物分数", "商站和市民乘区块", "金币和建筑剩余加分"]
    },
    {
      id: crypto.randomUUID(),
      name: "盖亚计划",
      minPlayers: 1,
      maxPlayers: 4,
      duration: 150,
      complexity: "重",
      lastPlayed: "2025-08-02",
      cover: "",
      forgets: ["联邦连接时卫星数量和能量消耗要一起核对", "研究升到顶必须拿对应科技板限制"],
      disputes: ["被动充能是否能拒绝", "星球改造费用受哪些能力影响"],
      setup: ["随机终局计分板和回合得分板", "按种族设置起始资源和母星"],
      scoring: ["终局计分板", "科技轨排名", "联邦和建筑分"]
    },
    {
      id: crypto.randomUUID(),
      name: "花砖物语",
      minPlayers: 2,
      maxPlayers: 4,
      duration: 45,
      complexity: "轻",
      lastPlayed: "2026-03-15",
      cover: "",
      forgets: ["每轮结束先铺墙再补工厂展示区", "地板线扣分后清空对应砖"],
      disputes: ["同色砖放置限制是否看整面墙", "中央区起始玩家标记是否必须拿"],
      setup: ["按人数放工厂圆盘", "每个圆盘补4块砖"],
      scoring: ["横竖相邻即时分", "完整行列和颜色终局加分"]
    }
  ]
};

let state = loadState();
if (!state.selectedId) state.selectedId = state.games[0]?.id || "";

const els = {
  searchInput: document.querySelector("#searchInput"),
  playerFilter: document.querySelector("#playerFilter"),
  complexityFilter: document.querySelector("#complexityFilter"),
  sortMode: document.querySelector("#sortMode"),
  gameForm: document.querySelector("#gameForm"),
  nameInput: document.querySelector("#nameInput"),
  minPlayersInput: document.querySelector("#minPlayersInput"),
  maxPlayersInput: document.querySelector("#maxPlayersInput"),
  durationInput: document.querySelector("#durationInput"),
  complexityInput: document.querySelector("#complexityInput"),
  lastPlayedInput: document.querySelector("#lastPlayedInput"),
  coverInput: document.querySelector("#coverInput"),
  gameList: document.querySelector("#gameList"),
  detailView: document.querySelector("#detailView"),
  gameCount: document.querySelector("#gameCount"),
  ruleCount: document.querySelector("#ruleCount"),
  staleGame: document.querySelector("#staleGame"),
  visibleCount: document.querySelector("#visibleCount"),
  scheduleView: document.querySelector("#scheduleView"),
  scheduleStatus: document.querySelector("#scheduleStatus")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Math.max(0, Math.floor((today - date) / 86400000));
}

function getAllRules(game) {
  return [...game.forgets, ...game.disputes, ...game.setup, ...game.scoring];
}

function getFilteredGames() {
  const keyword = els.searchInput.value.trim();
  const player = els.playerFilter.value;
  const complexity = els.complexityFilter.value;
  const games = state.games.filter((game) => {
    const text = `${game.name}${getAllRules(game).join("")}`;
    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesPlayer = player === "all" || (Number(player) >= game.minPlayers && Number(player) <= game.maxPlayers);
    const matchesComplexity = complexity === "all" || game.complexity === complexity;
    return matchesKeyword && matchesPlayer && matchesComplexity;
  });

  if (els.sortMode.value === "name") return games.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (els.sortMode.value === "complexity") {
    const rank = { 轻: 1, 中: 2, 重: 3 };
    return games.sort((a, b) => rank[b.complexity] - rank[a.complexity]);
  }
  return games.sort((a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed));
}

function renderSummary() {
  const allRuleCount = state.games.reduce((sum, game) => sum + getAllRules(game).length, 0);
  const stale = [...state.games].sort((a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed))[0];
  els.gameCount.textContent = state.games.length;
  els.ruleCount.textContent = allRuleCount;
  els.staleGame.textContent = stale ? `${daysSince(stale.lastPlayed)}天` : "-";
}

function renderList() {
  const games = getFilteredGames();
  els.visibleCount.textContent = `${games.length}个匹配`;
  els.gameList.innerHTML =
    games
      .map((game) => {
        const selected = game.id === state.selectedId ? "selected" : "";
        return `
          <article class="game-card ${selected}" data-game-id="${game.id}">
            <div class="cover">
              ${
                game.cover
                  ? `<img src="${game.cover}" alt="${escapeHtml(game.name)}封面" />`
                  : `<span>${escapeHtml(game.name.slice(0, 2))}</span>`
              }
              <span class="stale-ribbon">${daysSince(game.lastPlayed)}天未玩</span>
            </div>
            <div class="game-body">
              <h3>${escapeHtml(game.name)}</h3>
              <div class="game-meta">
                <span class="pill">${game.minPlayers}-${game.maxPlayers}人</span>
                <span class="pill">${game.duration}分钟</span>
                <span class="pill heavy">${escapeHtml(game.complexity)}</span>
              </div>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的桌游。</p>`;
}

function renderDetail() {
  const game = state.games.find((item) => item.id === state.selectedId) || state.games[0];
  if (!game) {
    els.detailView.innerHTML = `<p class="empty">先添加一个桌游。</p>`;
    return;
  }
  state.selectedId = game.id;
  els.detailView.innerHTML = `
    <div class="quick-card">
      <div class="detail-cover">
        ${game.cover ? `<img src="${game.cover}" alt="${escapeHtml(game.name)}封面" />` : `<span>${escapeHtml(game.name.slice(0, 2))}</span>`}
      </div>
      <div>
        <h2>${escapeHtml(game.name)}</h2>
        <div class="game-meta">
          <span class="pill">${game.minPlayers}-${game.maxPlayers}人</span>
          <span class="pill">${game.duration}分钟</span>
          <span class="pill heavy">${escapeHtml(game.complexity)}</span>
          <span class="pill">${daysSince(game.lastPlayed)}天未玩</span>
        </div>
      </div>
      ${renderRuleSection("容易忘的规则", "forgets", game.forgets)}
      ${renderRuleSection("常见争议", "disputes", game.disputes)}
      ${renderRuleSection("开局准备", "setup", game.setup)}
      ${renderRuleSection("计分提醒", "scoring", game.scoring)}
      <form class="add-rule" id="ruleForm">
        <select id="ruleTypeInput">
          <option value="forgets">容易忘的规则</option>
          <option value="disputes">常见争议</option>
          <option value="setup">开局准备</option>
          <option value="scoring">计分提醒</option>
        </select>
        <textarea id="ruleTextInput" rows="3" placeholder="补充一条聚会前要看的提醒" required></textarea>
        <button class="primary" type="submit">加入规则卡片</button>
      </form>
      <div class="detail-actions">
        <button id="playedTodayBtn" type="button">标记今天玩过</button>
        <button id="deleteGameBtn" type="button">删除桌游</button>
      </div>
    </div>
  `;
}

function renderRuleSection(title, key, items) {
  return `
    <section class="rule-section">
      <h3>${title}</h3>
      <ul class="rule-list">
        ${
          items
            .map(
              (item, index) => `
                <li>
                  <span>${escapeHtml(item)}</span>
                  <button type="button" title="删除" data-rule-key="${key}" data-rule-index="${index}">×</button>
                </li>
              `
            )
            .join("") || `<li><span>暂无内容。</span></li>`
        }
      </ul>
    </section>
  `;
}

function getDraft() {
  if (!state.scheduleDraft) {
    state.scheduleDraft = { playerCount: 4, availableMinutes: 30, selectedIds: [] };
  }
  const draft = state.scheduleDraft;
  if (!Number.isFinite(Number(draft.playerCount))) draft.playerCount = 4;
  if (!Number.isFinite(Number(draft.availableMinutes))) draft.availableMinutes = 30;
  if (!Array.isArray(draft.selectedIds)) draft.selectedIds = [];
  return draft;
}

// 支持当前人数的收藏游戏，即排程候选
function getScheduleCandidates(playerCount) {
  return state.games.filter((game) => playerCount >= game.minPlayers && playerCount <= game.maxPlayers);
}

function getHeavyCandidates(playerCount) {
  return getScheduleCandidates(playerCount).filter((game) => game.complexity === "重");
}

// 同步必选：支持人数的重度游戏必须入选；已删除的 id 清掉
function syncDraftSelection() {
  const draft = getDraft();
  const candidates = getScheduleCandidates(Number(draft.playerCount));
  const candidateIds = new Set(candidates.map((game) => game.id));
  draft.selectedIds = draft.selectedIds.filter((id) => candidateIds.has(id));
  candidates.forEach((game) => {
    if (game.complexity === "重" && !draft.selectedIds.includes(game.id)) {
      draft.selectedIds.push(game.id);
    }
  });
}

// 排程生成时的游戏快照：锁定后收藏中新增的争议/遗忘点不得回写历史
function buildGameSnapshot(game) {
  let order = 0;
  const items = ruleTypeMeta.flatMap((type) =>
    game[type.key].map((text) => ({
      id: crypto.randomUUID(),
      type: type.key,
      typeTitle: type.title,
      text,
      checked: false
    }))
  ).map((item) => ({ ...item, order: order++ }));
  return {
    gameId: game.id,
    name: game.name,
    complexity: game.complexity,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    staleDays: daysSince(game.lastPlayed),
    items
  };
}

function getSnapshotsFromGameIds(gameIds) {
  return gameIds
    .map((id) => state.games.find((game) => game.id === id))
    .filter(Boolean)
    .map(buildGameSnapshot);
}

function summarizeSnapshots(snapshots) {
  const items = snapshots.flatMap((snapshot) => snapshot.items);
  const totalRules = items.length;
  const minutes = totalRules * reviewMinutesPerRule;
  const heavyCount = snapshots.filter((snapshot) => snapshot.complexity === "重").length;
  const disputeCount = items.filter((item) => item.type === "disputes").length;
  const forgetCount = items.filter((item) => item.type === "forgets").length;
  const staleCount = snapshots.filter((snapshot) => snapshot.staleDays >= 60).length;
  const maxStaleDays = snapshots.reduce((max, snapshot) => Math.max(max, snapshot.staleDays), 0);
  let riskLevel = "低";
  if (heavyCount >= 2 || disputeCount >= 3 || maxStaleDays >= 120) riskLevel = "高";
  else if (heavyCount === 1 || disputeCount >= 1 || maxStaleDays >= 60) riskLevel = "中";
  const checked = items.filter((item) => item.checked).length;
  return { totalRules, minutes, heavyCount, disputeCount, forgetCount, staleCount, maxStaleDays, riskLevel, checked };
}

function renderStatsBar(stats, availableMinutes) {
  const over = availableMinutes ? stats.minutes > availableMinutes : false;
  return `
    <div class="schedule-stats ${over ? "over" : ""}">
      <span><b>${stats.minutes}</b>复习分钟${availableMinutes ? ` / ${availableMinutes}可用` : ""}</span>
      <span><b>${stats.checked}/${stats.totalRules}</b>已复习</span>
      <span><b>${stats.heavyCount}</b>重度</span>
      <span><b>${stats.forgetCount}</b>遗忘点</span>
      <span><b>${stats.disputeCount}</b>争议点</span>
      <span><b>${stats.staleCount}</b>款搁置60天+</span>
      <span class="risk risk-${stats.riskLevel}">风险 <b>${stats.riskLevel}</b></span>
    </div>
  `;
}

function renderPlanner() {
  syncDraftSelection();
  const draft = getDraft();
  const playerCount = Number(draft.playerCount);
  const available = Number(draft.availableMinutes);
  const candidates = getScheduleCandidates(playerCount);
  const heavyIds = new Set(candidates.filter((game) => game.complexity === "重").map((game) => game.id));
  const unsupportedHeavy = state.games.filter(
    (game) => game.complexity === "重" && !(playerCount >= game.minPlayers && playerCount <= game.maxPlayers)
  );

  const selectedGames = state.games.filter((game) => draft.selectedIds.includes(game.id));
  const stats = summarizeSnapshots(selectedGames.map(buildGameSnapshot));
  const over = stats.minutes > available;

  const rows = candidates
    .map((game) => {
      const required = heavyIds.has(game.id);
      const checked = draft.selectedIds.includes(game.id);
      const ruleCount = getAllRules(game).length;
      return `
        <li class="plan-game ${checked ? "picked" : ""}">
          <label class="pick">
            <input type="checkbox" data-pick-id="${game.id}" ${checked ? "checked" : ""} ${required ? "disabled" : ""} />
            <span>${escapeHtml(game.name)}</span>
            ${required ? `<em class="required-tag">重度必选</em>` : ""}
          </label>
          <span class="plan-meta">
            <span class="pill ${game.complexity === "重" ? "heavy" : ""}">${escapeHtml(game.complexity)}</span>
            <span class="pill">${ruleCount}条 · ${ruleCount * reviewMinutesPerRule}分钟</span>
            <span class="pill">${daysSince(game.lastPlayed)}天未玩</span>
          </span>
        </li>
      `;
    })
    .join("") || `<li class="plan-empty">当前人数没有可排程的收藏游戏。</li>`;

  els.scheduleStatus.textContent = "未排程";
  els.scheduleView.innerHTML = `
    <div class="planner">
      <div class="plan-fields">
        <label>
          玩家人数
          <input id="planPlayerCount" type="number" min="1" max="12" value="${playerCount}" />
        </label>
        <label>
          可用分钟
          <input id="planAvailable" type="number" min="1" step="1" value="${available}" />
        </label>
        <p class="plan-hint">按每条规则卡片复习 ${reviewMinutesPerRule} 分钟估算；支持当前人数的重度游戏必须入选。</p>
      </div>
      <ul class="plan-list">${rows}</ul>
      ${
        unsupportedHeavy.length
          ? `<p class="plan-note">重度游戏不支持 ${playerCount} 人：${unsupportedHeavy
              .map((game) => `${escapeHtml(game.name)}（${game.minPlayers}-${game.maxPlayers}人）`)
              .join("、")}</p>`
          : ""
      }
      ${renderStatsBar(stats, available)}
      <p class="plan-error ${over ? "show" : ""}" id="planReject">
        复习总时长 ${stats.minutes} 分钟，超出可用 ${available} 分钟，整场拒绝：请减少游戏或增加可用时间。原排程与收藏不变。
      </p>
      <div class="plan-actions">
        <button class="primary" id="createSessionBtn" type="button" ${draft.selectedIds.length ? "" : "disabled"}>
          生成复习排程
        </button>
        <span class="plan-hint">超时仍可点击，但不会生成排程。</span>
      </div>
    </div>
  `;
}

function renderActive(session) {
  const stats = summarizeSnapshots(session.games);
  const allDone = stats.totalRules > 0 && stats.checked === stats.totalRules;
  const progress = stats.totalRules ? Math.round((stats.checked / stats.totalRules) * 100) : 0;

  const sections = session.games
    .map(
      (snapshot) => `
      <article class="session-game">
        <header>
          <h3>${escapeHtml(snapshot.name)}</h3>
          <div class="game-meta">
            <span class="pill ${snapshot.complexity === "重" ? "heavy" : ""}">${escapeHtml(snapshot.complexity)}</span>
            <span class="pill">${snapshot.items.length}条 · ${snapshot.items.length * reviewMinutesPerRule}分钟</span>
            <span class="pill">${snapshot.staleDays}天未玩</span>
          </div>
        </header>
        ${ruleTypeMeta
          .map((type) => {
            const items = snapshot.items.filter((item) => item.type === type.key);
            if (!items.length) return "";
            return `
              <section class="rule-section">
                <h4>${type.title}</h4>
                <ul class="review-list">
                  ${items
                    .map(
                      (item) => `
                    <li class="${item.checked ? "done" : ""}">
                      <label>
                        <input type="checkbox" data-item-id="${item.id}" ${item.checked ? "checked" : ""} />
                        <span>${escapeHtml(item.text)}</span>
                      </label>
                    </li>
                  `
                    )
                    .join("")}
                </ul>
              </section>
            `;
          })
          .join("")}
      </article>
    `
    )
    .join("");

  els.scheduleStatus.textContent = `复习中 ${stats.checked}/${stats.totalRules}`;
  els.scheduleView.innerHTML = `
    <div class="session active-session">
      <div class="session-head">
        <p class="plan-hint">${session.playerCount} 人局 · 可用 ${session.availableMinutes} 分钟 · ${session.games.length} 款 · 创建于 ${session.createdAt}</p>
      </div>
      ${renderStatsBar(stats, session.availableMinutes)}
      <div class="progress-track"><span style="width:${progress}%"></span></div>
      <div class="session-games">${sections}</div>
      <div class="plan-actions">
        <button class="primary" id="finishSessionBtn" type="button" ${allDone ? "" : "disabled"}>
          ${allDone ? "结束并锁定排程" : `还剩 ${stats.totalRules - stats.checked} 项未勾选`}
        </button>
        <button id="abandonSessionBtn" type="button">放弃排程</button>
      </div>
    </div>
  `;
}

function renderLocked(session) {
  const stats = summarizeSnapshots(session.games);
  const sections = session.games
    .map(
      (snapshot) => `
      <article class="session-game locked-game">
        <header>
          <h3>${escapeHtml(snapshot.name)}</h3>
          <div class="game-meta">
            <span class="pill ${snapshot.complexity === "重" ? "heavy" : ""}">${escapeHtml(snapshot.complexity)}</span>
            <span class="pill">${snapshot.items.length}条</span>
            <span class="pill">${snapshot.staleDays}天未玩</span>
          </div>
        </header>
        <ul class="review-list">
          ${snapshot.items
            .map(
              (item) => `
            <li class="done locked-item">
              <span class="item-type">${item.typeTitle}</span>
              <span>${escapeHtml(item.text)}</span>
            </li>
          `
            )
            .join("")}
        </ul>
      </article>
    `
    )
    .join("");

  els.scheduleStatus.textContent = `已锁定 ${session.lockedAt}`;
  els.scheduleView.innerHTML = `
    <div class="session locked-session">
      <div class="locked-banner">
        <strong>排程已锁定</strong>
        <span>${session.playerCount} 人局 · 全部 ${stats.totalRules} 项已复习 · 创建 ${session.createdAt} · 锁定 ${session.lockedAt}</span>
        <span>历史记录为排程时快照，之后收藏中新增的争议或遗忘点不会回写本场。</span>
      </div>
      ${renderStatsBar(stats, session.availableMinutes)}
      <div class="session-games">${sections}</div>
      <div class="plan-actions">
        <button class="primary" id="planNextBtn" type="button">规划下一场</button>
      </div>
    </div>
  `;
}

function renderSchedule() {
  const session = state.session;
  if (session && session.status === "locked") {
    renderLocked(session);
  } else if (session && session.status === "active") {
    renderActive(session);
  } else {
    renderPlanner();
  }
}

function renderAll() {
  renderSummary();
  renderList();
  renderDetail();
  renderSchedule();
  // 渲染过程中可能同步草稿（如重度必选），统一在最后持久化
  saveState();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addGame(event) {
  event.preventDefault();
  const minPlayers = Number(els.minPlayersInput.value);
  const maxPlayers = Math.max(minPlayers, Number(els.maxPlayersInput.value));
  const cover = await readFileAsDataUrl(els.coverInput.files[0]);
  const game = {
    id: crypto.randomUUID(),
    name: els.nameInput.value.trim(),
    minPlayers,
    maxPlayers,
    duration: Number(els.durationInput.value),
    complexity: els.complexityInput.value,
    lastPlayed: els.lastPlayedInput.value,
    cover,
    forgets: ["本局开始前先补充容易忘的规则。"],
    disputes: [],
    setup: ["整理组件并按人数调整初始设置。"],
    scoring: ["确认终局计分项和即时得分项。"]
  };
  state.games.unshift(game);
  state.selectedId = game.id;
  els.gameForm.reset();
  setDefaultDate();
  renderAll();
}

function setDefaultDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  els.lastPlayedInput.value = date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.searchInput.addEventListener("input", renderAll);
els.playerFilter.addEventListener("change", renderAll);
els.complexityFilter.addEventListener("change", renderAll);
els.sortMode.addEventListener("change", renderAll);
els.gameForm.addEventListener("submit", addGame);

function timestampNow() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

els.scheduleView.addEventListener("change", (event) => {
  const playerInput = event.target.closest("#planPlayerCount");
  const availableInput = event.target.closest("#planAvailable");
  const pick = event.target.closest("[data-pick-id]");
  const reviewItem = event.target.closest("[data-item-id]");

  // 规划表单与候选勾选只在无排程时可操作
  if ((playerInput || availableInput || pick) && state.session) return;

  const draft = getDraft();

  if (playerInput) {
    draft.playerCount = Math.max(1, Math.min(12, Number(playerInput.value) || 1));
    syncDraftSelection();
    renderAll();
    return;
  }

  if (availableInput) {
    draft.availableMinutes = Math.max(1, Number(availableInput.value) || 1);
    renderAll();
    return;
  }

  if (pick && !pick.disabled) {
    const id = pick.dataset.pickId;
    if (pick.checked) {
      if (!draft.selectedIds.includes(id)) draft.selectedIds.push(id);
    } else {
      draft.selectedIds = draft.selectedIds.filter((item) => item !== id);
    }
    renderAll();
    return;
  }

  if (reviewItem && state.session && state.session.status === "active") {
    const item = state.session.games
      .flatMap((snapshot) => snapshot.items)
      .find((entry) => entry.id === reviewItem.dataset.itemId);
    if (item) {
      item.checked = reviewItem.checked;
      renderAll();
    }
  }
});

els.scheduleView.addEventListener("click", (event) => {
  const createButton = event.target.closest("#createSessionBtn");
  const finishButton = event.target.closest("#finishSessionBtn");
  const abandonButton = event.target.closest("#abandonSessionBtn");
  const planNextButton = event.target.closest("#planNextBtn");
  const draft = getDraft();

  if (createButton) {
    syncDraftSelection();
    const playerCount = Number(draft.playerCount);
    const availableMinutes = Number(draft.availableMinutes);
    const heavy = getHeavyCandidates(playerCount);
    const missingHeavy = heavy.filter((game) => !draft.selectedIds.includes(game.id));
    if (!draft.selectedIds.length || missingHeavy.length) return;

    const snapshots = getSnapshotsFromGameIds(draft.selectedIds);
    const stats = summarizeSnapshots(snapshots);
    // 超时整场拒绝：不写 session，原排程与收藏不变
    if (stats.minutes > availableMinutes) {
      renderPlanner();
      const reject = document.querySelector("#planReject");
      if (reject) {
        reject.classList.add("show", "rejected");
        reject.textContent = `❌ 已拒绝生成：复习总时长 ${stats.minutes} 分钟，超出可用 ${availableMinutes} 分钟。原排程与收藏不变。`;
      }
      return;
    }

    state.session = {
      status: "active",
      playerCount,
      availableMinutes,
      createdAt: timestampNow(),
      lockedAt: "",
      games: snapshots
    };
    renderAll();
    return;
  }

  if (finishButton && state.session && state.session.status === "active") {
    const stats = summarizeSnapshots(state.session.games);
    if (stats.totalRules === 0 || stats.checked !== stats.totalRules) return;
    state.session.status = "locked";
    state.session.lockedAt = timestampNow();
    renderAll();
    return;
  }

  if (abandonButton) {
    state.session = null;
    renderAll();
    return;
  }

  if (planNextButton) {
    state.session = null;
    renderAll();
  }
});

els.gameList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-game-id]");
  if (!card) return;
  state.selectedId = card.dataset.gameId;
  renderAll();
});

els.detailView.addEventListener("submit", (event) => {
  if (event.target.id !== "ruleForm") return;
  event.preventDefault();
  const game = state.games.find((item) => item.id === state.selectedId);
  if (!game) return;
  const key = document.querySelector("#ruleTypeInput").value;
  const text = document.querySelector("#ruleTextInput").value.trim();
  if (!text) return;
  game[key].push(text);
  renderAll();
});

els.detailView.addEventListener("click", (event) => {
  const ruleButton = event.target.closest("[data-rule-key]");
  const playedButton = event.target.closest("#playedTodayBtn");
  const deleteButton = event.target.closest("#deleteGameBtn");
  const game = state.games.find((item) => item.id === state.selectedId);
  if (!game) return;

  if (ruleButton) {
    const key = ruleButton.dataset.ruleKey;
    const index = Number(ruleButton.dataset.ruleIndex);
    game[key].splice(index, 1);
    renderAll();
  }

  if (playedButton) {
    game.lastPlayed = new Date().toISOString().slice(0, 10);
    renderAll();
  }

  if (deleteButton) {
    state.games = state.games.filter((item) => item.id !== game.id);
    state.selectedId = state.games[0]?.id || "";
    renderAll();
  }
});

setDefaultDate();
renderAll();
