import { readRuntimeAssets, runtimeFailure } from './runtime-support.mjs';

const runtimeRoot = new URL('./runtime/python/', self.location.href).href;
let python;
self.onmessage = async ({ data }) => {
  if (data.type !== 'run') return;
  let phase = 'resources', standardLibraryUrl;
  const logs = [];
  const remember = line => { logs.push(String(line).slice(0, 1500)); if (logs.length > 30) logs.shift(); };
  try {
    if (!python) {
      self.postMessage({ type: 'status', message: '正在检查 Python 运行资源…' });
      const { assets } = await readRuntimeAssets(runtimeRoot);
      phase = 'initialize';
      self.postMessage({ type: 'status', message: '正在初始化 Python…' });
      const { loadPyodide } = await import(`${runtimeRoot}pyodide.mjs`);
      // Use the verified in-memory standard library instead of a second URL load.
      standardLibraryUrl = URL.createObjectURL(new Blob([assets['python_stdlib.zip']], { type: 'application/zip' }));
      python = await loadPyodide({
        indexURL: runtimeRoot,
        stdLibURL: standardLibraryUrl,
        lockFileContents: new TextDecoder().decode(assets['pyodide-lock.json']),
        packageBaseUrl: runtimeRoot,
        stdout: remember,
        stderr: remember,
      });
      URL.revokeObjectURL(standardLibraryUrl); standardLibraryUrl = null;
      phase = 'bridge';
      const bridge = await fetch(new URL('./runtime_bridge.py', self.location.href)).then(r => {
        if (!r.ok) throw new Error('无法加载 Python 游戏接口。');
        return r.text();
      });
      python.runPython(bridge);
      self.postMessage({ type: 'ready' });
    }
    if (data.type === 'run') {
      phase = 'execute';
      const execute = python.globals.get('execute_request');
      try { self.postMessage({ type: 'result', result: JSON.parse(execute(JSON.stringify(data.payload))) }); }
      finally { execute.destroy(); }
    }
  } catch (error) { self.postMessage(runtimeFailure(error, phase, logs)); }
  finally { if (standardLibraryUrl) URL.revokeObjectURL(standardLibraryUrl); }
};
