import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { freshSave, normalizeSave, canOpen, judge, validateDlcManifest } from '../src/core.js';
const campaign=JSON.parse(readFileSync(new URL('../content/python/campaign.json',import.meta.url)));
const solutions=JSON.parse(readFileSync(new URL('./solutions.json',import.meta.url)));
const levels=campaign.levels;
function run(code,level){return JSON.parse(execFileSync('python',['tests/verify_python.py'],{input:JSON.stringify({code,level}),encoding:'utf8',timeout:10000}));}
test('关卡 ID 唯一，全部关卡都有教学、示例和三级提示',()=>{
 assert.equal(new Set(levels.map(l=>l.id)).size,levels.length);
 assert.equal(levels.length,140);
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

test('Alpha.2 全序幕存档恢复后开启第一幕，保留草稿与提示',()=>{
 const saved=freshSave(); saved.currentLevel=levels[19].id;
 for(const l of levels.slice(0,20)) saved.completed[l.id]={completedAt:'2026-10-28',runs:2};
 saved.drafts[levels[19].id]='# 原来的草稿'; saved.hints[levels[19].id]=2;
 const recovered=normalizeSave(saved,levels.map(l=>l.id));
 assert.equal(Object.keys(recovered.completed).length,20);
 assert.equal(recovered.drafts[levels[19].id],'# 原来的草稿');
 assert.equal(recovered.hints[levels[19].id],2);
 assert.equal(canOpen(levels[20],levels,recovered),true);
 assert.equal(canOpen(levels[21],levels,recovered),false);
});
test('行动变式拒绝写死四步，函数题拒绝未调用的空函数',()=>{
 const world=levels.find(l=>l.id==='python.workshop.002');
 assert.equal(judge(world,run('def travel(n):\n    robot.right(4)\ntravel(4)',world)).passed,false);
 const fn=levels.find(l=>l.id==='python.workshop.004');
 assert.equal(judge(fn,run('def unused(x):\n    return x\nx = int(input())\nprint(x * 2)',fn)).passed,false);
});

test('排序挑战可跳过，不阻断第二幕后续关卡',()=>{
 const save=freshSave(); const before=levels.find(l=>l.id==='python.algorithms.009');
 save.completed[before.id]={runs:1};
 assert.equal(canOpen(levels.find(l=>l.id==='python.control.001'),levels,save),true);
});
test('全部解锁保留真实通关进度，忽略未知关卡并兼容旧存档',()=>{
 const save=freshSave(); save.unlockedLevels=[...levels.map(l=>l.id),'unknown.level'];
 save.drafts[levels[0].id]='# 保留草稿';save.hints[levels[0].id]=2;
 const restored=normalizeSave(save,levels.map(l=>l.id));
 assert.equal(restored.unlockedLevels.length,140);
 assert.equal(Object.keys(restored.completed).length,0);
 assert.equal(restored.drafts[levels[0].id],'# 保留草稿');
 assert.equal(restored.hints[levels[0].id],2);
 assert.ok(levels.every(l=>canOpen(l,levels,restored)));
 const old={...save};delete old.unlockedLevels;
 assert.deepEqual(normalizeSave(old,levels.map(l=>l.id)).unlockedLevels,[]);
});
test('虚拟文件检查拒绝只打印，JSON接受不同排版',()=>{
 const file=levels.find(l=>l.id==='python.files.003');
 assert.equal(judge(file,run('print(\"\")',file)).passed,false);
 const jsonLevel=levels.find(l=>l.id==='python.files.008');
 const code=solutions[jsonLevel.id].replace('ensure_ascii=False','ensure_ascii=True, indent=2');
 assert.equal(judge(jsonLevel,run(code,jsonLevel)).passed,true);
});
test('模块草稿与档案快照兼容旧存档并保留有效文件',()=>{
 const save=freshSave(),id='python.modules.007';
 save.moduleDrafts[id]={'tools.py':'def double(n): return n*3','../bad.py':'x'};
 save.projectFiles[id]={'record.json':'{}'};
 const restored=normalizeSave(JSON.parse(JSON.stringify(save)),levels.map(l=>l.id));
 assert.equal(restored.moduleDrafts[id]['tools.py'],'def double(n): return n*3');
 assert.equal(restored.moduleDrafts[id]['../bad.py'],undefined);
 assert.equal(restored.projectFiles[id]['record.json'],'{}');
});
test('模块可编辑且错误定位到模块；虚拟文件禁止目录逃逸',()=>{
 const level={...levels.find(l=>l.id==='python.modules.007'),modules:{'tools.py':'def double(n):\n    return missing_name'}};
 const result=run(solutions[level.id],level);
 assert.equal(result.error.file,'tools.py');assert.equal(result.error.line,2);
 const file=levels.find(l=>l.id==='python.files.001');
 assert.equal(run("open('../outside.txt','w')",file).error.type,'ValueError');
});
