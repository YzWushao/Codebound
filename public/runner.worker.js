const runtimeRoot = new URL('./runtime/python/', self.location.href).href;
let python;
self.onmessage = async ({ data }) => {
  try {
    if (!python) {
      const { loadPyodide } = await import(`${runtimeRoot}pyodide.mjs`);
      python = await loadPyodide({ indexURL: runtimeRoot });
      const bridge = await fetch(new URL('./runtime_bridge.py', self.location.href)).then(r => {
        if (!r.ok) throw new Error('无法加载 Python 游戏接口。');
        return r.text();
      });
      python.runPython(bridge);
      self.postMessage({ type: 'ready' });
    }
    if (data.type === 'run') {
      const execute = python.globals.get('execute_request');
      try { self.postMessage({ type: 'result', result: JSON.parse(execute(JSON.stringify(data.payload))) }); }
      finally { execute.destroy(); }
    }
  } catch (error) { self.postMessage({ type: 'failure', message: String(error.message || error) }); }
};
