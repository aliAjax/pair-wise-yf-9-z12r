const storageKey = "zfl18-boardgame-rule-cards";
const today = new Date();

const defaultState = {
  selectedId: "",
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
  ],
  schedule: {
    draft: { gameIds: [], playerCount: 4, minutes: 60 },
    lastRejection: null,
    current: null,
    history: []
  }
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
  scheduleStatus: document.querySelector("#scheduleStatus"),
  scheduleView: document.querySelector("#scheduleView")
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

const reviewBaseMinutes = { 轻: 6, 中: 10, 重: 15 };

function estimateReviewMinutes(game) {
  return (reviewBaseMinutes[game.complexity] || 8) + getAllRules(game).length;
}

function fitsPlayerCount(game, playerCount) {
  return playerCount >= game.minPlayers && playerCount <= game.maxPlayers;
}

function getScheduleSelection() {
  const { playerCount, gameIds } = state.schedule.draft;
  const fitting = state.games.filter((game) => fitsPlayerCount(game, playerCount));
  const forced = fitting.filter((game) => game.complexity === "重");
  const chosen = fitting.filter((game) => gameIds.includes(game.id));
  const merged = new Map();
  [...chosen, ...forced].forEach((game) => merged.set(game.id, game));
  return { fitting, forced, selected: [...merged.values()] };
}

function assessRisk(schedule) {
  const heavy = schedule.items.filter((item) => item.complexity === "重").length;
  const maxStale = schedule.items.reduce((max, item) => Math.max(max, item.staleDays), 0);
  const slack = schedule.availableMinutes - schedule.totalMinutes;
  let score = 0;
  if (heavy >= 2) score += 2;
  else if (heavy === 1) score += 1;
  if (maxStale >= 180) score += 2;
  else if (maxStale >= 90) score += 1;
  if (slack <= 5) score += 2;
  else if (slack <= 15) score += 1;
  const level = score >= 3 ? "高" : score >= 1 ? "中" : "低";
  return { heavy, maxStale, slack, level };
}

function countRules(items, key) {
  return items.reduce((sum, item) => sum + item.rules[key].length, 0);
}

function formatTime(iso) {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createSchedule(event) {
  event.preventDefault();
  const draft = state.schedule.draft;
  draft.playerCount = Number(document.querySelector("#schedulePlayers").value);
  draft.minutes = Number(document.querySelector("#scheduleMinutes").value);
  const { selected } = getScheduleSelection();

  if (selected.length < 2) {
    state.schedule.lastRejection = { reason: "too-few", playerCount: draft.playerCount };
    renderAll();
    return;
  }

  const totalMinutes = selected.reduce((sum, game) => sum + estimateReviewMinutes(game), 0);
  if (totalMinutes > draft.minutes) {
    state.schedule.lastRejection = {
      reason: "overtime",
      at: new Date().toISOString(),
      playerCount: draft.playerCount,
      availableMinutes: draft.minutes,
      totalMinutes,
      gameNames: selected.map((game) => game.name)
    };
    renderAll();
    return;
  }

  state.schedule.current = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    playerCount: draft.playerCount,
    availableMinutes: draft.minutes,
    totalMinutes,
    items: selected.map((game) => ({
      id: crypto.randomUUID(),
      gameId: game.id,
      gameName: game.name,
      complexity: game.complexity,
      minutes: estimateReviewMinutes(game),
      staleDays: daysSince(game.lastPlayed),
      rules: {
        forgets: [...game.forgets],
        disputes: [...game.disputes],
        setup: [...game.setup],
        scoring: [...game.scoring]
      },
      done: false
    }))
  };
  state.schedule.lastRejection = null;
  renderAll();
}

function endSchedule() {
  const current = state.schedule.current;
  if (!current || current.items.some((item) => !item.done)) return;
  state.schedule.history.unshift({ ...structuredClone(current), endedAt: new Date().toISOString() });
  state.schedule.current = null;
  renderAll();
}

function renderSchedule() {
  const current = state.schedule.current;
  els.scheduleStatus.textContent = current ? "进行中" : "待安排";
  els.scheduleView.innerHTML = `
    ${current ? renderActiveSchedule(current) : renderPlanner()}
    ${renderScheduleHistory()}
  `;
}

function renderPlanner() {
  const draft = state.schedule.draft;
  const { selected } = getScheduleSelection();
  const totalMinutes = selected.reduce((sum, game) => sum + estimateReviewMinutes(game), 0);
  const heavyCount = selected.filter((game) => game.complexity === "重").length;
  const over = totalMinutes > draft.minutes;

  const rows = state.games
    .map((game) => {
      const fits = fitsPlayerCount(game, draft.playerCount);
      const forced = fits && game.complexity === "重";
      const checked = forced || (fits && draft.gameIds.includes(game.id));
      const tags = [forced ? "必入" : "", fits ? "" : "人数不符"].filter(Boolean).join(" · ");
      return `
        <label class="pick-row ${fits ? "" : "disabled"}">
          <input type="checkbox" class="pick-game" value="${game.id}" ${checked ? "checked" : ""} ${!fits || forced ? "disabled" : ""} />
          <span class="pick-name">${escapeHtml(game.name)}</span>
          <span class="pick-meta">${game.minPlayers}-${game.maxPlayers}人 · ${escapeHtml(game.complexity)} · 约${estimateReviewMinutes(game)}分钟${tags ? ` · ${tags}` : ""}</span>
        </label>
      `;
    })
    .join("");

  return `
    <div class="planner">
      <form id="plannerForm" class="planner-form">
        <div class="split">
          <label>
            玩家人数
            <input id="schedulePlayers" type="number" min="1" max="12" value="${draft.playerCount}" required />
          </label>
          <label>
            可用分钟
            <input id="scheduleMinutes" type="number" min="5" step="5" value="${draft.minutes}" required />
          </label>
        </div>
        <div class="pick-list">${rows || `<p class="empty">收藏为空，先添加桌游。</p>`}</div>
        <p class="planner-hint">复杂度为「重」的桌游必须入选，会自动勾选且不可取消；入选游戏复习时长之和超过可用分钟时，整场拒绝，原排程与收藏不变。</p>
        <button class="primary" type="submit">生成复习排程</button>
      </form>
      <div class="planner-side">
        <h3>本场预览</h3>
        <div class="stat-grid">
          <div><span>已选游戏</span><strong>${selected.length}</strong></div>
          <div><span>预计复习</span><strong>${totalMinutes}分钟</strong></div>
          <div><span>可用分钟</span><strong>${draft.minutes}</strong></div>
          <div><span>重度必入</span><strong>${heavyCount}</strong></div>
        </div>
        ${over ? `<p class="over-warning">预计时长已超过可用分钟，提交将整场拒绝。</p>` : ""}
        ${renderRejection()}
      </div>
    </div>
  `;
}

function renderRejection() {
  const rejection = state.schedule.lastRejection;
  if (!rejection) return "";
  if (rejection.reason === "too-few") {
    return `<div class="rejection">整场拒绝：${rejection.playerCount}人局可选桌游不足两款（复杂度为重的桌游必须入选）。原排程与收藏未改动。</div>`;
  }
  return `
    <div class="rejection">
      整场拒绝：入选 ${rejection.gameNames.length} 款（${rejection.gameNames.map(escapeHtml).join("、")}）共需 ${rejection.totalMinutes} 分钟，超过可用 ${rejection.availableMinutes} 分钟。原排程与收藏未改动。
    </div>
  `;
}

function renderActiveSchedule(current) {
  const doneItems = current.items.filter((item) => item.done);
  const doneMinutes = doneItems.reduce((sum, item) => sum + item.minutes, 0);
  const risk = assessRisk(current);
  const percent = Math.round((doneItems.length / current.items.length) * 100);
  const allDone = doneItems.length === current.items.length;

  return `
    <div class="active-schedule">
      <div class="stat-grid">
        <div><span>进度</span><strong>${doneItems.length}/${current.items.length} 项</strong></div>
        <div><span>已复习</span><strong>${doneMinutes}/${current.totalMinutes} 分钟</strong></div>
        <div><span>时间余量</span><strong>${risk.slack} 分钟</strong></div>
        <div><span>重度游戏</span><strong>${risk.heavy} 款</strong></div>
        <div><span>遗忘点 / 争议</span><strong>${countRules(current.items, "forgets")} / ${countRules(current.items, "disputes")}</strong></div>
        <div><span>最久未玩</span><strong>${risk.maxStale} 天</strong></div>
        <div><span>风险等级</span><strong class="risk risk-${risk.level}">${risk.level}</strong></div>
      </div>
      <div class="progress"><div class="progress-bar" style="width:${percent}%"></div></div>
      <div class="schedule-items">
        ${current.items.map(renderScheduleItem).join("")}
      </div>
      <div class="schedule-actions">
        <button id="endScheduleBtn" class="primary" type="button" ${allDone ? "" : "disabled"}>结束本场复习</button>
        ${allDone ? `<span class="hint">全部完成，可以结束并锁定记录。</span>` : `<span class="hint">逐项勾选完成后才能结束。</span>`}
      </div>
    </div>
  `;
}

function renderScheduleItem(item) {
  const section = (title, rules) =>
    rules.length
      ? `<div class="item-section"><strong>${title}</strong><ul>${rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul></div>`
      : "";
  return `
    <article class="schedule-item ${item.done ? "done" : ""}">
      <label class="item-head">
        <input type="checkbox" data-item-id="${item.id}" ${item.done ? "checked" : ""} />
        <span class="item-name">${escapeHtml(item.gameName)}</span>
        <span class="pill heavy">${escapeHtml(item.complexity)}</span>
        <span class="pill">${item.minutes}分钟</span>
        <span class="pill">${item.staleDays}天未玩</span>
      </label>
      <div class="item-body">
        ${section("容易忘", item.rules.forgets)}
        ${section("争议", item.rules.disputes)}
        ${section("准备", item.rules.setup)}
        ${section("计分", item.rules.scoring)}
      </div>
    </article>
  `;
}

function renderScheduleHistory() {
  const records = state.schedule.history;
  if (!records.length) return "";
  return `
    <div class="schedule-history">
      <h3>历史场次（结束后锁定，新增争议或遗忘点不会回写）</h3>
      ${records
        .map(
          (record) => `
            <article class="history-record">
              <header>
                <strong>${formatTime(record.endedAt)}</strong>
                <span class="pill">${record.playerCount}人</span>
                <span class="pill">${record.totalMinutes}/${record.availableMinutes}分钟</span>
                <span class="pill">风险${assessRisk(record).level}</span>
                <span class="pill locked">已锁定</span>
              </header>
              <ul>
                ${record.items
                  .map(
                    (item) =>
                      `<li>${escapeHtml(item.gameName)} · ${item.minutes}分钟 · 遗忘${item.rules.forgets.length} · 争议${item.rules.disputes.length}</li>`
                  )
                  .join("")}
              </ul>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAll() {
  saveState();
  renderSummary();
  renderList();
  renderDetail();
  renderSchedule();
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

els.scheduleView.addEventListener("submit", (event) => {
  if (event.target.id !== "plannerForm") return;
  createSchedule(event);
});

els.scheduleView.addEventListener("change", (event) => {
  if (event.target.classList.contains("pick-game")) {
    const id = event.target.value;
    const ids = state.schedule.draft.gameIds;
    state.schedule.draft.gameIds = event.target.checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id);
    renderAll();
    return;
  }

  if (event.target.id === "schedulePlayers" || event.target.id === "scheduleMinutes") {
    state.schedule.draft.playerCount = Number(document.querySelector("#schedulePlayers").value) || 1;
    state.schedule.draft.minutes = Number(document.querySelector("#scheduleMinutes").value) || 5;
    renderAll();
    return;
  }

  const itemId = event.target.dataset.itemId;
  if (itemId && state.schedule.current) {
    const item = state.schedule.current.items.find((entry) => entry.id === itemId);
    if (!item) return;
    item.done = event.target.checked;
    renderAll();
  }
});

els.scheduleView.addEventListener("click", (event) => {
  if (event.target.id === "endScheduleBtn") endSchedule();
});

setDefaultDate();
renderAll();
