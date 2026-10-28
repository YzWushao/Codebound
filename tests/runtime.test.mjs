import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';
import { readRuntimeAssets, runtimeFailure } from '../public/runtime-support.mjs';
import { judge } from '../src/core.js';

const root = new URL('../public/runtime/python/', import.meta.url);
async function fileFetch(url) {
  try { return new Response(await readFile(url)); }
  catch (error) { if (error.code === 'ENOENT') return new Response('', { status: 404 }); throw error; }
}

test('分发资源通过大小和 SHA-256 校验', async () => {
  const result = await readRuntimeAssets(root, fileFetch);
  assert.equal(result.version, '314.0.7');
  assert.ok(result.assets['python_stdlib.zip'].length > 1000000);
});

test('缺少标准库时指出文件名，不进入 Python 初始化', async () => {
  await assert.rejects(readRuntimeAssets(root, url => url.pathname.endsWith('python_stdlib.zip') ? new Response('', { status: 404 }) : fileFetch(url)), /python_stdlib.zip.*404/);
});

test('同样大小但已损坏的标准库会被校验拦截', async () => {
  await assert.rejects(readRuntimeAssets(root, async url => {
    if (!url.pathname.endsWith('python_stdlib.zip')) return fileFetch(url);
    const bytes = await readFile(url); bytes[100] ^= 1; return new Response(bytes);
  }), /校验失败.*python_stdlib.zip/);
});

test('初始化退出保留阶段与 Python 标准错误', () => {
  const result = runtimeFailure({ name: 'ExitStatus', message: 'Program terminated with exit(1)' }, 'initialize', ['Fatal Python error: failed to get the Python codec', 'ModuleNotFoundError: encodings']);
  assert.match(result.message, /初始化 Python失败/);
  assert.match(result.detail, /exit\(1\)/);
  assert.match(result.detail, /ModuleNotFoundError: encodings/);
});

test('真实 Pyodide 执行全部 20 关；两步移动只是不达标，不会退出运行器', async () => {
  const checked = await readRuntimeAssets(root, fileFetch);
  const python = await loadPyodide({
    indexURL: fileURLToPath(root),
    lockFileContents: new TextDecoder().decode(checked.assets['pyodide-lock.json']),
    packageBaseUrl: root.href,
  });
  python.runPython(await readFile(new URL('../public/runtime_bridge.py', import.meta.url), 'utf8'));
  const campaign = JSON.parse(await readFile(new URL('../content/python/campaign.json', import.meta.url), 'utf8'));
  const solutions = JSON.parse(await readFile(new URL('./solutions.json', import.meta.url), 'utf8'));
  const execute = python.globals.get('execute_request');
  try {
    const short = JSON.parse(execute(JSON.stringify({ code: 'robot.right()\nrobot.right()', level: campaign.levels[0] })));
    assert.equal(short.error, null);
    assert.equal(short.state.player.x, 4);
    assert.equal(judge(campaign.levels[0], short).passed, false);
    for (const level of campaign.levels) {
      const result = JSON.parse(execute(JSON.stringify({ code: solutions[level.id], level })));
      assert.equal(result.error, null, level.id);
      assert.equal(judge(level, result).passed, true, level.id);
    }
  } finally { execute.destroy(); }
});
