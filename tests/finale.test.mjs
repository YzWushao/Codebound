import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { freshSave, normalizeSave, canOpen, judge, APP_VERSION } from '../src/core.js';

const campaign = JSON.parse(readFileSync(new URL('../content/python/campaign.json', import.meta.url)));
const solutions = JSON.parse(readFileSync(new URL('./solutions.json', import.meta.url)));
const levels = campaign.levels;
const find = id => levels.find(level => level.id === id);
function run(code, level) {
  return JSON.parse(execFileSync('python', ['tests/verify_python.py'], {
    input: JSON.stringify({code, level}), encoding: 'utf8', timeout: 10000,
  }));
}

test('终幕在第三幕后包含四区各十关，全部归属唯一且有变式和教学辅助', () => {
  const finale = campaign.acts.at(-1);
  assert.equal(finale.id, 'finale');
  assert.equal(finale.title, '终幕');
  assert.equal(finale.units.length, 4);
  assert.equal(levels.length, 180);
  for (const chapter of finale.units) {
    const group = levels.filter(level => level.chapter === chapter);
    assert.equal(group.length, 10);
    for (const level of group) {
      assert.ok(level.learn && level.example && level.starter && solutions[level.id]);
      assert.equal(level.hints.length, 3);
      assert.ok(level.cases.length >= 2);
    }
  }
  for (const level of levels) {
    assert.equal(campaign.acts.filter(act => act.units.includes(level.chapter)).length, 1);
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.version, APP_VERSION);
});

test('Alpha.4的140关存档开启终幕并保留完成记录、草稿、提示、模块和快照', () => {
  const saved = freshSave();
  saved.currentLevel = levels[139].id;
  for (const level of levels.slice(0, 140)) saved.completed[level.id] = {completedAt:'2026-11-01',runs:2};
  saved.drafts[levels[139].id] = '# 旧版草稿';
  saved.hints[levels[139].id] = 2;
  saved.moduleDrafts['python.modules.007'] = {'tools.py': 'def double(n): return n * 2'};
  saved.projectFiles[levels[139].id] = {'stations.json': '{"A":2}'};
  const restored = normalizeSave(JSON.parse(JSON.stringify(saved)), levels.map(level => level.id));
  assert.equal(restored.schemaVersion, 1);
  assert.equal(Object.keys(restored.completed).length, 140);
  assert.equal(restored.drafts[levels[139].id], '# 旧版草稿');
  assert.equal(restored.hints[levels[139].id], 2);
  assert.equal(restored.projectFiles[levels[139].id]['stations.json'], '{"A":2}');
  assert.equal(restored.moduleDrafts['python.modules.007']['tools.py'], 'def double(n): return n * 2');
  assert.equal(canOpen(levels[140], levels, restored), true);
  assert.equal(canOpen(levels[141], levels, restored), false);
});

test('旧版仅全部解锁不伪造完成，终幕仍按实际通关解锁', () => {
  const saved = freshSave();
  saved.unlockedLevels = levels.slice(0, 140).map(level => level.id);
  const restored = normalizeSave(saved, levels.map(level => level.id));
  assert.equal(restored.unlockedLevels.length, 140);
  assert.equal(canOpen(levels[139], levels, restored), true);
  assert.equal(canOpen(levels[140], levels, restored), false);
  assert.equal(Object.keys(restored.completed).length, 0);
});

test('终幕枚举拒绝只打印当前样例', () => {
  const level = find('python.strategy.001');
  const result = run('print([3, 6, 9])', level);
  assert.equal(result.checks.some(check => !check.passed), true);
  assert.equal(judge(level, result).passed, false);
});

test('递归训练拒绝用非递归函数绕过，真实递归可观察', () => {
  const level = find('python.recursion.002');
  const loop = 'n=int(input())\ndef sum_to(n):\n    total=0\n    for value in range(n+1):\n        total+=value\n    return total\nprint(sum_to(n))';
  const result = run(loop, level);
  assert.equal(result.error, null);
  assert.equal(result.checks.every(check => check.passed), true);
  assert.equal(judge(level, result).passed, false);
  assert.match(judge(level, result).message, /递归/);
  const recursive = run(solutions[level.id], level);
  assert.ok(recursive.recursiveFunctions.includes('sum_to'));
});

test('递归失控给出结束条件相关中文错误', () => {
  const result = run('def again():\n    return again()\nagain()', find('python.recursion.001'));
  assert.equal(result.error.type, 'RecursionError');
  assert.match(result.error.message, /结束条件/);
});

test('对象训练拒绝定义闲置类，要求创建实例', () => {
  const level = find('python.objects.001');
  const result = run('name=input()\nclass Station:\n    pass\nprint(name)', level);
  assert.equal(result.error, null);
  assert.equal(result.checks.every(check => check.passed), true);
  assert.equal(judge(level, result).passed, false);
  assert.match(judge(level, result).message, /实例/);
});

test('对象方法被实际调用，实例属性出现在最终状态和回放中', () => {
  const level = find('python.objects.004');
  const result = run(solutions[level.id], level);
  assert.equal(judge(level, result).passed, true);
  assert.ok(result.instanceClasses.includes('Battery'));
  assert.ok(result.calledFunctions.includes('charge'));
  assert.match(result.variables.battery, /energy=100/);
  assert.ok(result.events.some(event => /energy=80/.test(event.variables.battery ?? event.variables.self ?? '')));
});

test('工作区模块定义的类也能识别实例，零站点变式可通过', () => {
  const level = find('python.expedition.004');
  const result = run(solutions[level.id], level);
  assert.equal(judge(level, result).passed, true);
  assert.ok(result.instanceClasses.includes('Station'));
  assert.equal(result.checks.every(check => check.passed), true);
});

test('档案恢复保持损坏原文，缺失时不创建文件', () => {
  const template = find('python.expedition.008');
  for (const dataFiles of [{}, {'archive.json': '{broken'}, {'archive.json': '{"A":true}'}]) {
    const level = {...template, dataFiles, cases: [], rules: {...template.rules, files: dataFiles, output: '{}'}};
    const result = run(solutions[level.id], level);
    assert.equal(result.error, null);
    assert.equal(result.output.trim(), '{}');
    assert.deepEqual(result.files, dataFiles);
    assert.equal(judge(level, result).passed, true);
  }
});

test('毕业项目必须生成报告并真实抵达终点', () => {
  const level = find('python.expedition.010');
  const solution = solutions[level.id];
  const noMovement = run(solution.replace('robot.right(distance)', 'pass'), level);
  assert.equal(judge(level, noMovement).passed, false);
  assert.match(judge(level, noMovement).message, /传送点/);
  const noReport = run(solution.replace("storage.save('report.json', report)", 'pass'), level);
  assert.equal(judge(level, noReport).passed, false);
  assert.match(judge(level, noReport).message, /report.json/);
});

test('毕业项目处理无记录与非法记录，变式文件和模块不串用', () => {
  const level = find('python.expedition.010');
  const result = run(solutions[level.id], level);
  assert.equal(judge(level, result).passed, true);
  assert.deepEqual(JSON.parse(result.files['report.json']), {accepted:2,query:5,total:7});
  assert.equal(result.checks.length, 2);
  assert.ok(result.checks.every(check => check.passed));
  const empty = {...level, ...level.cases[0], cases: []};
  const independent = run(solutions[level.id], empty);
  assert.deepEqual(JSON.parse(independent.files['stations.json']), {});
  assert.deepEqual(JSON.parse(independent.files['report.json']), {accepted:0,query:0,total:0});
});
