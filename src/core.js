export const SAVE_VERSION = 1;
export const APP_VERSION = '0.1.0-alpha.1';
export function initialScene(level) {
  let player = { x: 1, y: 1 }; const batteries = [];
  level.map.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === 'S') player = { x, y };
    if (cell === 'B') batteries.push({ x, y });
  }));
  return { player, batteries, energy: level.energy ?? 100, collected: 0 };
}
export function judge(level, result) {
  if (result.error) return { passed: false, message: result.error.message };
  const rules = level.rules;
  const p = result.state.player;
  if (rules.atGoal && level.map[p.y]?.[p.x] !== 'G') return { passed: false, message: '程序运行完了，Byte 还没有抵达绿色传送点。再检查一下路线。' };
  if (rules.collected && result.state.collected < rules.collected) return { passed: false, message: `还需要收集电池：${result.state.collected} / ${rules.collected}。` };
  if (rules.minEnergy && result.state.energy < rules.minEnergy) return { passed: false, message: `电量需要至少 ${rules.minEnergy}，现在是 ${result.state.energy}。` };
  if (rules.output !== undefined && result.output.trim() !== rules.output.trim()) return { passed: false, message: '程序成功运行了，但输出与目标还不一致。检查数字、大小写和换行。' };
  for (const [key, value] of Object.entries(rules.variables ?? {})) {
    if (result.variables[key] !== value) return { passed: false, message: `检查变量 ${key}，它需要保存 ${value}。` };
  }
  const labels = { For: 'for 循环', While: 'while 循环', If: 'if 判断', Assign: '变量赋值', BinOp: '算术运算', BoolOp: 'and / or 条件' };
  for (const node of rules.nodes ?? []) {
    if (!result.nodes.includes(node)) return { passed: false, message: `结果已经接近了！本关请使用${labels[node] || node}，练习新学到的知识。` };
  }
  if (result.checks?.some(check => !check.passed)) return { passed: false, message: '当前输入通过了，但换一组输入还没有通过。请让程序处理不同的数据，不要把答案写死。' };
  return { passed: true, message: '任务完成！你又点亮了校园的一角。' };
}
export function freshSave() {
  return { schemaVersion: SAVE_VERSION, currentLevel: 'python.wake.001', completed: {}, drafts: {}, hints: {}, settings: { speed: 1, fontSize: 15, sound: false }, updatedAt: new Date().toISOString() };
}
export function normalizeSave(value, levelIds) {
  if (!value || value.schemaVersion !== SAVE_VERSION || typeof value !== 'object') throw new Error('存档格式或版本不支持。');
  const save = freshSave();
  if (levelIds.includes(value.currentLevel)) save.currentLevel = value.currentLevel;
  for (const id of levelIds) {
    if (value.completed?.[id]) save.completed[id] = { completedAt: String(value.completed[id].completedAt || ''), runs: Number(value.completed[id].runs) || 1 };
    if (typeof value.drafts?.[id] === 'string' && value.drafts[id].length <= 20000) save.drafts[id] = value.drafts[id];
    if (Number.isInteger(value.hints?.[id])) save.hints[id] = Math.max(0, Math.min(3, value.hints[id]));
  }
  if ([0.5, 1, 2, 4].includes(value.settings?.speed)) save.settings.speed = value.settings.speed;
  if ([13, 15, 17, 19].includes(value.settings?.fontSize)) save.settings.fontSize = value.settings.fontSize;
  return save;
}
export function canOpen(level, levels, save) {
  const index = levels.findIndex(item => item.id === level.id);
  return index === 0 || Boolean(save.completed[level.id]) || Boolean(save.completed[levels[index - 1]?.id]);
}
export class LanguageRegistry {
  #runners = new Map();
  register(id, factory) { this.#runners.set(id, factory); }
  create(id) {
    if (!this.#runners.has(id)) throw new Error(`语言运行器 ${id} 尚未安装。`);
    return this.#runners.get(id)();
  }
}
export function validateDlcManifest(pack) {
  if (pack?.schemaVersion !== 1 || !/^[a-z][a-z0-9-]{1,40}$/.test(pack?.id || '') || !pack.language || !pack.version || pack.engineApi !== 1 || !pack.entry || !pack.runtime) throw new Error('语言包描述不完整或接口版本不兼容。');
  if (pack.language === 'python') throw new Error('Python 是内置主线，通过本体更新。');
  return pack;
}
