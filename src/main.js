import './styles.css';
import { createIcons, icons } from 'lucide';
import campaign from '../content/python/campaign.json';
import { APP_VERSION, freshSave, normalizeSave, initialScene, judge, canOpen, LanguageRegistry } from './core.js';
import { PythonRunner } from './runner.js';
import { World } from './world.js';
import { createEditor } from './editor.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
const renderIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
const levels = campaign.levels;
const levelIds = levels.map(level => level.id);
const desktop = window.codebound;
if (desktop?.platform !== 'desktop') {
  document.querySelector('#app').textContent = '请通过 Codebound.exe 启动桌面版。';
  throw new Error('Codebound 桌面版需要 Electron preload 接口。');
}
const saveKey = 'codebound.save.v1';
let save = freshSave(), storageWarning = '', saveTimer;
try { const stored = localStorage.getItem(saveKey); if (stored) save = normalizeSave(JSON.parse(stored), levelIds); }
catch { storageWarning = '本地存档无法读取，已创建新进度。你也可以在设置中导入备份。'; }
try { const stored = await desktop.loadSave(); if (stored) save = normalizeSave(stored, levelIds); }
catch { storageWarning = '桌面存档读取失败，本次先使用客户端缓存中的进度。'; }
let current = levels.find(level => level.id === save.currentLevel) || levels[0];
if (!canOpen(current, levels, save)) current = levels.find(level => !save.completed[level.id]) || levels[0];
let expandedChapter = current.chapter;
let scene = initialScene(current), editor, world, running = false, computing = false, paused = false;
let runToken = 0, replay = [], replayIndex = 0, runResult = null, activeTab = 'code';
let localRuns = 0, toastTimer, saving = false;
const registry = new LanguageRegistry(); registry.register('python', () => new PythonRunner());
const runner = registry.create('python');

function persist(immediate = false) {
  clearTimeout(saveTimer);
  const write = async () => {
    save.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(saveKey, JSON.stringify(save));
      await desktop.saveSave(save);
      const status = $('.save-status'); if (status) status.textContent = '已保存到本机';
    } catch { toast('存档未能写入，请在设置中导出备份。', true); }
  };
  if (immediate) return write();
  saveTimer = setTimeout(write, 300);
}

function toast(message, error = false) {
  clearTimeout(toastTimer); $('.toast')?.remove();
  const element = document.createElement('div'); element.className = `toast${error ? ' error' : ''}`;
  element.textContent = message; element.setAttribute('role', 'status'); document.body.append(element);
  toastTimer = setTimeout(() => element.remove(), 4300);
}

function plannedActs() {
  return `<div class="planned-acts"><div class="side-label">NEXT EXPEDITIONS</div>${campaign.acts.filter(act=>act.status==='planned').map(act=>`<div class="planned-act">${icon('lock-keyhole')}<span><strong>${esc(act.title)} · ${esc(act.name)}</strong><small>后续内容 · 规划中</small></span></div>`).join('')}</div>`;
}
function renderSidebar() {
  const done = levels.filter(level => save.completed[level.id]).length;
  $('#sidebar').innerHTML = `<div class="side-heading"><div class="side-label">YOUR ADVENTURE</div><div class="campaign-name"><h2>序·幕</h2><span class="tiny-badge">PYTHON 主线</span></div><div class="progress-track"><span style="width:${done / levels.length * 100}%"></span></div><div class="progress-label"><span>探索进度</span><span>${done} / ${levels.length} 关</span></div></div><nav class="chapter-list" aria-label="序幕入门单元">${campaign.chapters.map((chapter, index) => {
    const chapterLevels = levels.filter(level => level.chapter === chapter.id);
    const count = chapterLevels.filter(level => save.completed[level.id]).length;
    return `<div class="chapter"><button class="chapter-button ${current.chapter === chapter.id ? 'current' : ''}" data-chapter="${chapter.id}" aria-expanded="${expandedChapter === chapter.id}"><span class="chapter-icon" style="--chapter-color:${chapter.color}">${icon(chapter.icon)}</span><span><span class="chapter-title">${String(index + 1).padStart(2,'0')} ${chapter.title}</span><span class="chapter-subtitle">${chapter.subtitle}</span></span><span class="chapter-count">${count}/${chapterLevels.length}</span></button>${expandedChapter === chapter.id ? `<div class="lesson-list">${chapterLevels.map((level, n) => `<button class="lesson-link ${level.id === current.id ? 'selected' : ''} ${save.completed[level.id] ? 'complete' : ''}" data-level="${level.id}" ${canOpen(level, levels, save) ? '' : 'disabled'} ${level.id === current.id ? 'aria-current="step"' : ''}><span class="lesson-num">${String(n + 1).padStart(2,'0')}</span>${esc(level.title)}${icon(save.completed[level.id] ? 'circle-check' : canOpen(level, levels, save) ? 'circle' : 'lock-keyhole')}</button>`).join('')}</div>` : ''}</div>`;
  }).join('')}</nav>${plannedActs()}<div class="sidebar-footer">${icon('sparkles')}<div>大问题，从一小步开始。</div><p>每天探索一点，代码会成为你的超能力。</p></div>`;
  $('#completion-count').textContent = done;
  renderIcons();
}

function render() {
  const index = levels.indexOf(current), chapter = campaign.chapters.find(item => item.id === current.chapter);
  $('#app').innerHTML = `<div class="app-shell"><header class="topbar"><button class="brand" data-action="overview" aria-label="Codebound 冒险地图"><span class="brand-mark">${icon('code-xml')}</span>CODEBOUND<span class="alpha">ALPHA</span></button><nav class="topnav" aria-label="主导航"><button class="active" data-action="overview">${icon('map')}冒险地图</button><button data-action="dlc">${icon('puzzle')}语言扩展</button><button data-action="settings">${icon('settings-2')}设置</button></nav><div class="top-end"><span class="offline-dot">本地存档</span><span class="avatar" title="探索者">CB</span></div></header><div class="layout"><aside class="sidebar" id="sidebar"></aside><main class="workspace"><section class="welcome"><div><div class="eyebrow">HELLO, EXPLORER / 你好，探索者</div><h1>写下代码，开启下一关<span style="color:#c7ef7b">。</span></h1><p>用真实的 Python，从序·幕出发，和 Byte 一起点亮校园。</p></div><div class="journey-pill">${icon('trophy')}<div><strong><span id="completion-count">0</span><span style="font-size:12px;color:#6f8575"> / ${levels.length}</span></strong><small>已经完成的冒险</small></div></div></section><div class="mission-strip"><div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="sidebar" aria-label="展开章节">${icon('menu')}</button><span>Python · 序·幕</span>${icon('chevron-right')}<span>${chapter.title}</span>${icon('chevron-right')}<span style="color:#c9d9c5">${esc(current.title)}</span></div><span class="mission-type">${icon(current.type === 'world' ? 'gamepad-2' : 'terminal')}${current.type === 'world' ? '行动关卡' : '独立练习'}</span></div><div class="play-grid"><div class="world-column"><section class="panel"><div class="panel-head"><div class="panel-title">${icon('orbit')}<span>校园 · ${chapter.title}</span></div><span class="live-dot">BYTE 已连接</span></div><div class="world-wrap"><canvas id="world" aria-label="Byte 的校园地图，紫色机器人为起点，绿色方框为终点。"></canvas><div class="map-overlay"><span class="sector-label">SECTOR ${String(campaign.chapters.indexOf(chapter)+1).padStart(2,'0')}</span></div></div><div class="world-controls"><span class="legend"><span class="legend-swatch"></span>Byte</span><span class="legend"><span class="legend-swatch goal"></span>传送点</span><span class="legend"><span class="legend-swatch battery"></span>电池</span><label class="world-speed">回放<select id="speed" aria-label="回放速度">${[.5,1,2,4].map(n => `<option value="${n}" ${save.settings.speed === n ? 'selected' : ''}>${n}×</option>`).join('')}</select></label></div><div class="world-stats"><div class="stat">${icon('battery-charging')}<span>能量<strong id="energy-stat">100 / 100</strong></span></div><div class="stat">${icon('package')}<span>已收集<strong id="inventory-stat">0 块电池</strong></span></div><div class="stat">${icon('map-pin')}<span>坐标<strong id="position-stat">0, 0</strong></span></div></div></section><section class="panel task-panel"><div class="task-heading">${icon('flag')}<span>${esc(current.title)}</span><span class="task-number">MISSION ${String(index+1).padStart(2,'0')} / ${levels.length}</span></div><p>${esc(current.brief)}</p><div class="goal-item">${icon('circle-dashed')}<span>${esc(current.goal)}</span></div>${current.input ? `<div class="input-block">${icon('log-in')}<span>本关输入</span><code>${current.input.map(esc).join('\n')}</code><span style="color:#607866">每行对应一次 input()</span></div>` : ''}</section></div><section class="panel editor-panel"><div class="panel-head"><div class="editor-tabs"><button class="editor-tab active" data-tab="code">${icon('code-2')}我的代码</button><button class="editor-tab" data-tab="learn">${icon('book-open')}示例与讲解</button></div><span class="language-tag">${icon('circle-dot')}Python</span></div><div class="file-bar"><span>${icon('file-code-2')}mission_${String(index+1).padStart(2,'0')}.py</span><span class="save-status">已保存到本机</span></div><div class="editor-host" id="editor"></div><div class="learn-view hidden" id="learn-view"><h3>${esc(current.concept)}</h3><p>${esc(current.learn)}</p><pre>${esc(current.example)}</pre><p style="font-size:10px;color:#778e7b">先理解这个例子的写法，再回到「我的代码」，根据本关目标调整。示例不一定是本关的完整答案。</p><button class="secondary-button" data-action="back-to-code">${icon('arrow-left')}回到我的代码</button></div><div class="editor-toolbar"><button class="run-button" data-action="run" title="Ctrl + Enter">${icon('play')}运行代码</button><button class="tool-button" data-action="step" title="逐条查看执行过程">${icon('step-forward')}单步</button><button class="icon-button" data-action="pause" title="暂停 / 继续回放" aria-label="暂停或继续回放" disabled>${icon('pause')}</button><button class="icon-button" data-action="stop" title="停止运行" aria-label="停止运行" disabled>${icon('square')}</button><button class="icon-button" data-action="reset" title="重置起始代码" aria-label="重置起始代码">${icon('rotate-ccw')}</button><span class="shortcut">Ctrl ↵ 运行</span></div><div class="console" aria-live="polite"><div class="console-head"><span>${icon('terminal')}运行终端</span><span class="console-state" id="console-state">等待指令</span></div><div class="console-body"><span id="output" class="console-placeholder">准备好了，写下你的第一行代码吧。</span><div id="feedback" class="feedback"></div><div id="variables" class="variables"></div></div></div></section></div><div class="knowledge-row"><section class="knowledge-card"><div class="knowledge-heading">${icon('book-open')}本关知识 · ${esc(current.concept)}</div><p>${esc(current.learn)}</p></section><section class="knowledge-card hint-card"><div class="hint-top"><div class="knowledge-heading">${icon('lightbulb')}Byte 的小提示</div><button class="hint-button" data-action="hint">查看提示 <span id="hint-count">0 / 3</span>${icon('arrow-up-right')}</button></div><div class="hint-copy" id="hint-copy">卡住也没关系。先看思路，再一步步找到答案。</div></section></div><footer class="workspace-footer"><span>${icon('hard-drive')}进度自动保存在本机 · 离线也能探索</span><span>CODEBOUND ${APP_VERSION} · 每一小步，都算数</span></footer></main></div></div>`;
  world = new World($('#world')); scene = initialScene(current); world.set(current, scene, true);
  saving = false;
  editor = createEditor($('#editor'), save.drafts[current.id] ?? current.starter, code => {
    if (saving) return;
    save.drafts[current.id] = code; $('.save-status').textContent = '正在保存…'; persist();
  }, () => startRun());
  document.documentElement.style.setProperty('--editor-size', `${save.settings.fontSize}px`);
  activeTab = 'code'; renderSidebar(); updateStats(); updateHint(); renderIcons();
}

function updateStats() {
  $('#energy-stat').textContent = `${scene.energy} / 100`;
  $('#inventory-stat').textContent = `${scene.collected} 块电池`;
  $('#position-stat').textContent = `${scene.player.x}, ${scene.player.y}`;
}
function updateHint() {
  const count = save.hints[current.id] || 0;
  $('#hint-count').textContent = `${count} / 3`;
  $('#hint-copy').textContent = count ? current.hints[count - 1] : '卡住也没关系。先看思路，再一步步找到答案。';
}
function switchTab(tab) {
  activeTab = tab; $('#editor').classList.toggle('hidden', tab !== 'code'); $('#learn-view').classList.toggle('hidden', tab !== 'learn');
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  if (tab === 'code') editor.view.requestMeasure();
}
function controls() {
  $('[data-action="run"]').disabled = running;
  $('[data-action="step"]').disabled = computing || (running && !paused);
  $('[data-action="pause"]').disabled = !running || computing;
  $('[data-action="stop"]').disabled = !running;
  $('[data-action="pause"]').innerHTML = icon(paused ? 'play' : 'pause');
  $('#console-state').classList.toggle('status-flash', running && !paused); renderIcons();
}
function stopRun(quiet = false) {
  ++runToken; runner.stop(); running = computing = paused = false; replay = []; runResult = null;
  if (editor) editor.highlight(0); controls();
  if (!quiet) { $('#console-state').textContent = '已停止'; $('#feedback').textContent = '代码已停止，修改后可以再试一次。'; }
}
async function startRun(singleStep = false) {
  if (running) return;
  switchTab('code'); const token = ++runToken; running = computing = true; paused = Boolean(singleStep); localRuns++;
  scene = initialScene(current); world.set(current, scene, true); updateStats();
  $('#output').textContent = ''; $('#output').className = '';
  $('#feedback').textContent = ''; $('#feedback').className = 'feedback'; $('#variables').innerHTML = ''; controls();
  try {
    const result = await runner.run(editor.get(), current, status => { if (token === runToken) $('#console-state').textContent = status; });
    if (token !== runToken) return;
    computing = false; runResult = result; replay = result.events; replayIndex = 0; controls();
    if (singleStep) { $('#console-state').textContent = '单步回放'; advance(); }
    play(token);
  } catch (error) {
    if (token !== runToken || error.name === 'AbortError') return;
    running = computing = false; controls(); $('#console-state').textContent = '执行已停止';
    $('#feedback').className = 'feedback error'; $('#feedback').textContent = error.message;
  }
}
function advance() {
  if (replayIndex >= replay.length) { finish(); return; }
  const event = replay[replayIndex++]; scene = event.state; world.set(current, scene); updateStats(); editor.highlight(event.line || 0);
  if (event.kind === 'output') $('#output').textContent += event.text;
  $('#variables').innerHTML = Object.entries(event.variables || {}).map(([key,value]) => `<span class="variable">${esc(key)} = ${esc(typeof value === 'string' ? JSON.stringify(value) : value)}</span>`).join('');
  if (replayIndex >= replay.length) finish();
  return event;
}
async function play(token) {
  while (token === runToken && running && replayIndex < replay.length) {
    if (paused) { await new Promise(resolve => setTimeout(resolve, 90)); continue; }
    const event = advance();
    await new Promise(resolve => setTimeout(resolve, (event?.kind === 'line' ? 150 : 320) / save.settings.speed));
  }
}
function finish() {
  if (!runResult) return;
  const result = runResult; runResult = null; running = computing = paused = false; controls();
  $('#output').textContent = result.output || (result.error ? '' : '❯ 程序运行完毕。');
  const verdict = judge(current, result);
  $('#console-state').textContent = verdict.passed ? '全部检查通过' : result.error ? '需要调整一下' : '运行完成';
  $('#feedback').className = `feedback ${verdict.passed ? 'success' : 'error'}`;
  $('#feedback').textContent = `${result.error?.line ? `第 ${result.error.line} 行：` : ''}${verdict.message}`;
  if (result.error?.line) editor.highlight(result.error.line); else editor.highlight(0);
  if (result.error?.detail) {
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '查看 Python 原始错误';
    const raw = document.createElement('div'); raw.textContent = `${result.error.type}: ${result.error.detail}`; details.append(summary, raw); $('#feedback').append(details);
  }
  if (verdict.passed) {
    const firstTime = !save.completed[current.id];
    save.completed[current.id] = { completedAt: new Date().toISOString(), runs: localRuns }; persist(); renderSidebar();
    const levelAtFinish = current.id;
    setTimeout(() => { if (current.id === levelAtFinish && !running) successModal(firstTime); }, 350);
  }
}
function openLevel(id) {
  const next = levels.find(level => level.id === id);
  if (!next || !canOpen(next, levels, save)) return;
  closeModal(); stopRun(true); editor.dispose(); world.dispose(); current = next; expandedChapter = next.chapter;
  save.currentLevel = next.id; localRuns = 0; persist(); render(); window.scrollTo({ top: 0 });
}
let lastFocus;
function modal(content, cls = '') {
  closeModal(); lastFocus = document.activeElement;
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="Codebound 对话框" tabindex="-1">${content}</section>`;
  document.body.append(backdrop); renderIcons(); backdrop.querySelector('.modal').focus();
}
function closeModal() { $('.modal-backdrop')?.remove(); lastFocus?.focus?.(); }
function modalHeader(title) { return `<div class="modal-header"><h2>${title}</h2><button class="modal-close" data-action="close-modal" aria-label="关闭">${icon('x')}</button></div>`; }
function successModal(firstTime) {
  const index = levels.indexOf(current), next = levels[index + 1];
  modal(`<div class="success-emblem">${icon(index === levels.length - 1 ? 'party-popper' : 'flag')}</div><div class="eyebrow">MISSION COMPLETE</div><h2>${index === levels.length - 1 ? '校园，重新亮起来了。' : firstTime ? '又向前迈出了一步。' : '这一步，已经很熟练了。'}</h2><p>${esc(current.title)} · ${esc(current.concept)}<br>你正在把想法，变成能够运行的代码。</p><div class="success-pills"><span>✓ 目标达成</span><span>✓ ${resultCheckCount()} 组数据通过</span><span>${levels.filter(l=>save.completed[l.id]).length} / ${levels.length} 已完成</span></div><div class="button-row"><button class="secondary-button" data-action="close-modal">留在本关</button>${next ? `<button class="run-button" data-level="${next.id}">下一关 ${icon('arrow-right')}</button>` : `<button class="run-button" data-action="overview">回顾冒险 ${icon('map')}</button>`}</div>`, 'success-modal');
}
function resultCheckCount() { return 1 + (current.cases?.length || 0); }
function overview() {
  modal(`${modalHeader('你的冒险地图')}<p>序·幕 · Byte 苏醒：五个入门单元，共 ${levels.length} 个基础关卡。完成前一关，即可开启下一关。</p>${campaign.chapters.map(chapter => `<div class="knowledge-heading" style="margin-top:22px;color:${chapter.color}">${icon(chapter.icon)}${chapter.title}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${levels.filter(l=>l.chapter===chapter.id).map(level=>`<button class="secondary-button" style="justify-content:space-between" data-level="${level.id}" ${canOpen(level,levels,save)?'':'disabled'}>${esc(level.title)}${icon(save.completed[level.id]?'circle-check':canOpen(level,levels,save)?'arrow-up-right':'lock-keyhole')}</button>`).join('')}</div>`).join('')}${plannedActs()}`);
}
function dlcModal() {
  modal(`${modalHeader('更多语言，新的世界。')}<p>Python 是 Codebound 的内置主线。其他编程语言将在后续以独立扩展包加入桌面版，每个语言包都有自己的课程与进度。</p><div class="dlc-card">${icon('code-2')}<div><h3>Python · 序·幕</h3><p>${levels.length} 个序幕关卡，已随本体安装。</p></div><span class="dlc-status" style="color:#c7ef7b">内置主线</span></div><div class="dlc-card">${icon('cpu')}<div><h3>C · 机械工坊</h3><p>后续扩展 · 当前版本尚未提供课程与执行器。</p></div><span class="dlc-status">计划中</span></div><div class="dlc-card">${icon('braces')}<div><h3>C++ · 算法竞技场</h3><p>后续扩展 · 当前版本尚未提供课程与执行器。</p></div><span class="dlc-status">计划中</span></div><p class="muted">桌面扩展接口已预留。Alpha 先专注 Python 基础冒险。</p>`);
}
function settingsModal() {
  modal(`${modalHeader('探索者设置')}<div class="setting-row"><div>代码字号<small>选择适合阅读的大小。</small></div><select id="font-size" aria-label="代码字号">${[13,15,17,19].map(n=>`<option value="${n}" ${save.settings.fontSize===n?'selected':''}>${n}px</option>`).join('')}</select></div><div class="setting-row"><div>存档位置<small>电脑本地应用数据目录，升级本体时保留。</small></div><span class="tiny-badge">仅保存在本机</span></div><div class="setting-row"><div>Codebound<small>${APP_VERSION} · Python 内置主线</small></div><button class="secondary-button" data-action="check-updates">${icon('refresh-cw')}检查更新</button></div><p id="update-message" class="muted">桌面本体与语言扩展采用独立的更新接口。</p><div class="button-row"><button class="secondary-button" data-action="export">${icon('download')}导出存档</button><button class="secondary-button" data-action="import">${icon('upload')}导入存档</button></div><input class="hidden" id="save-file" type="file" accept="application/json,.json"><p class="muted">存档包含通关记录、代码草稿与设置。可通过导入导出备份或迁移进度。</p>`);
}
async function checkUpdates() {
  const output = $('#update-message'); output.textContent = '正在检查更新源…';
  try { const result = await desktop.checkUpdates(); output.textContent = result.message; }
  catch { output.textContent = '暂时无法连接更新源。你可以继续离线探索。'; }
}
function exportSave() {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `Codebound-save-${new Date().toISOString().slice(0,10)}.json`; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),5000);
}
document.addEventListener('click', event => {
  if (event.target.classList.contains('modal-backdrop')) { closeModal(); return; }
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.level) return openLevel(button.dataset.level);
  if (button.dataset.chapter) { expandedChapter = expandedChapter === button.dataset.chapter ? '' : button.dataset.chapter; renderSidebar(); return; }
  if (button.dataset.tab) return switchTab(button.dataset.tab);
  switch (button.dataset.action) {
    case 'run': return startRun();
    case 'step': if (running && paused && !computing) advance(); else if (!running) startRun(true); break;
    case 'pause': paused = !paused; $('#console-state').textContent = paused ? '回放已暂停' : '正在回放'; controls(); break;
    case 'stop': stopRun(); break;
    case 'hint': save.hints[current.id] = Math.min(3, (save.hints[current.id] || 0) + 1); updateHint(); persist(); break;
    case 'reset': modal(`${modalHeader('重新开始这一关？')}<p>将代码恢复为本关起始示例。通关记录会保留；当前草稿将被替换。</p><div class="button-row"><button class="secondary-button" data-action="close-modal">保留草稿</button><button class="run-button" data-action="confirm-reset">恢复起始代码</button></div>`); break;
    case 'confirm-reset': closeModal(); stopRun(true); editor.set(current.starter); scene = initialScene(current); world.set(current, scene,true); updateStats(); $('#output').textContent = '❯ 已恢复起始代码。'; $('#feedback').textContent = ''; $('#variables').innerHTML = ''; $('#console-state').textContent = '等待指令'; break;
    case 'overview': overview(); break;
    case 'dlc': dlcModal(); break;
    case 'settings': settingsModal(); break;
    case 'close-modal': closeModal(); break;
    case 'back-to-code': switchTab('code'); editor.view.focus(); break;
    case 'sidebar': $('#sidebar').classList.toggle('open'); break;
    case 'check-updates': checkUpdates(); break;
    case 'export': exportSave(); break;
    case 'import': $('#save-file').click(); break;
  }
});
document.addEventListener('change', async event => {
  if (event.target.id === 'speed') { save.settings.speed = Number(event.target.value); persist(); }
  if (event.target.id === 'font-size') { save.settings.fontSize = Number(event.target.value); document.documentElement.style.setProperty('--editor-size',`${save.settings.fontSize}px`); persist(); }
  if (event.target.id === 'save-file') {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('存档文件过大。');
      const imported = normalizeSave(JSON.parse(await file.text()), levelIds);
      modal(`${modalHeader('导入这份存档？')}<p>这份存档包含 ${Object.keys(imported.completed).length} 个已完成关卡。导入会替换本机的进度和草稿，建议先导出当前存档。</p><div class="button-row"><button class="secondary-button" data-action="export">导出当前存档</button><button class="run-button" id="confirm-import">确认导入</button></div>`);
      $('#confirm-import').addEventListener('click', async () => { stopRun(true); save = imported; await persist(true); editor.dispose(); world.dispose(); closeModal(); current = levels.find(l=>l.id===save.currentLevel)||levels[0]; if (!canOpen(current,levels,save)) current=levels.find(l=>!save.completed[l.id])||levels[0]; expandedChapter=current.chapter; render(); toast('存档已导入。'); }, { once: true });
    } catch (error) { toast(`导入失败：${error.message}`, true); }
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
  const dialog = $('.modal');
  if (dialog && event.key === 'Tab') {
    const focusable = [...dialog.querySelectorAll('button:not(:disabled),select,input:not(.hidden),[tabindex="0"]')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
  }
});
window.addEventListener('beforeunload', () => { clearTimeout(saveTimer); try { localStorage.setItem(saveKey,JSON.stringify(save)); } catch {} desktop.saveSave(save); });
render();
desktop.onFlush(async () => { await persist(true); });
if (storageWarning) toast(storageWarning,true);
