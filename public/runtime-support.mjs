export const RUNTIME_FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

export async function readRuntimeAssets(root, fetchAsset = fetch, cryptoApi = crypto) {
  async function read(name) {
    let response;
    try { response = await fetchAsset(new URL(name, root), { cache: 'no-store' }); }
    catch { throw new Error(`无法读取 Python 运行资源：${name}。请重新安装完整游戏。`); }
    if (!response.ok) throw new Error(`Python 运行资源缺失：${name}（${response.status}）。请重新安装完整游戏。`);
    return new Uint8Array(await response.arrayBuffer());
  }
  let manifest;
  try { manifest = JSON.parse(new TextDecoder().decode(await read('runtime-manifest.json'))); }
  catch (error) { throw new Error(`Python 运行资源清单无法读取。${error.message}`); }
  if (manifest.schemaVersion !== 1 || !manifest.version || !manifest.files) throw new Error('Python 运行资源清单无效，请重新安装完整游戏。');
  const assets = {};
  await Promise.all(RUNTIME_FILES.map(async name => {
    const expected = manifest.files[name];
    if (!expected || !Number.isSafeInteger(expected.size) || !/^[a-f0-9]{64}$/.test(expected.sha256)) throw new Error(`Python 运行资源清单缺少有效记录：${name}。`);
    const bytes = await read(name);
    if (bytes.length !== expected.size) throw new Error(`Python 运行资源不完整：${name}。请重新安装完整游戏。`);
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== expected.sha256) throw new Error(`Python 运行资源校验失败：${name}。请重新安装完整游戏。`);
    assets[name] = bytes;
  }));
  return { version: manifest.version, assets };
}

export function runtimeFailure(error, phase, logs = []) {
  const raw = String(error?.message || error);
  const phases = { resources: '检查运行资源', initialize: '初始化 Python', bridge: '加载游戏接口', execute: '执行程序' };
  const label = phases[phase] || '启动 Python';
  const message = phase === 'resources' ? raw : `${label}失败，请重试；仍然失败时请查看下方运行器诊断。`;
  const detail = [`阶段：${label}`, `${error?.name || 'Error'}: ${raw}`, ...logs.slice(-30)].join('\n').slice(0, 12000);
  return { type: 'failure', phase, message, detail };
}
