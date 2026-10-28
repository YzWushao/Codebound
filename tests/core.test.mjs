import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { freshSave, normalizeSave, canOpen, judge, validateDlcManifest } from '../src/core.js';
const campaign=JSON.parse(readFileSync(new URL('../content/python/campaign.json',import.meta.url)));
const solutions=JSON.parse(readFileSync(new URL('./solutions.json',import.meta.url)));
const levels=campaign.levels;
function run(code,level){return JSON.parse(execFileSync('python',['tests/verify_python.py'],{input:JSON.stringify({code,level}),encoding:'utf8',timeout:10000}));}
test('关卡 ID 唯一，20 关都有教学、示例和三级提示',()=>{
 assert.equal(new Set(levels.map(l=>l.id)).size,20);
 for(const l of levels){assert.ok(l.learn&&l.example&&l.starter);assert.equal(l.hints.length,3);assert.equal(l.map.filter(row=>row.includes('S')).length,1);assert.equal(l.map.filter(row=>row.includes('G')).length,1);assert.ok(solutions[l.id]);}
});
for(const level of levels)test(`参考解法及变式检查：${level.title}`,()=>{
 const result=run(solutions[level.id],level); assert.equal(result.error,null,JSON.stringify(result.error));
 assert.equal(judge(level,result).passed,true,JSON.stringify(judge(level,result)));
 assert.ok(result.events.length>0); assert.ok(result.events.every(event=>Number.isInteger(event.line)));
});
test('死循环被步骤限制中断并返回中文提示',()=>{const r=run('while True:\n    pass',levels[0]);assert.match(r.error.message,/循环/);});
test('缺少冒号给出正确行号',()=>{const r=run('if True\n    robot.right()',levels[0]);assert.equal(r.error.line,1);assert.match(r.error.message,/冒号/);});
test('墙壁碰撞不能通关',()=>{const r=run('robot.up()',levels[0]);assert.match(r.error.message,/墙壁/);assert.equal(judge(levels[0],r).passed,false);});
test('输入题拒绝写死答案',()=>{const level=levels.find(l=>l.id==='python.power.003');const r=run('print(20)',level);assert.equal(r.checks[0].passed,false);assert.equal(judge(level,r).passed,false);});
test('存档往返保留草稿进度；忽略未知内容，锁定后续关卡',()=>{
 const saved=freshSave();saved.completed[levels[0].id]={completedAt:'2026-10-26',runs:1};saved.drafts[levels[0].id]='print(1)';
 const recovered=normalizeSave(JSON.parse(JSON.stringify(saved)),levels.map(l=>l.id));
 assert.equal(recovered.drafts[levels[0].id],'print(1)');assert.ok(canOpen(levels[1],levels,recovered));assert.equal(canOpen(levels[2],levels,recovered),false);
 assert.throws(()=>normalizeSave({schemaVersion:99},[]));
});
test('Python 作为本体，语言包接口检查版本与字段',()=>{
 assert.throws(()=>validateDlcManifest({schemaVersion:1,id:'python-pack',language:'python',version:'1.0.0',engineApi:1,entry:'levels.json',runtime:'python'}));
 assert.ok(validateDlcManifest({schemaVersion:1,id:'c-foundations',language:'c',version:'1.0.0',engineApi:1,entry:'levels.json',runtime:'c-runner'}));
});
