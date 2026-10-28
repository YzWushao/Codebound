export class PythonRunner {
  worker = null; pending = null; timeout = null;
  async run(code, level, onStatus = () => {}) {
    this.stop();
    return new Promise((resolve, reject) => {
      this.pending = { reject };
      const fail = message => {
        this.pending = null;
        this.stop();
        reject(new Error(message));
      };
      this.worker = new Worker(new URL(`${import.meta.env.BASE_URL}runner.worker.js`, location.href), { type: 'module' });
      let ready = false;
      onStatus('正在唤醒 Python…');
      this.timeout = setTimeout(() => fail('Python 初始化超时，请重试。'), 45000);
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'ready') {
          ready = true; clearTimeout(this.timeout); onStatus('正在执行代码…');
          this.timeout = setTimeout(() => fail('程序运行超过 6 秒，已停止。请检查循环是否能够结束。'), 6000);
        }
        if (data.type === 'result' || data.type === 'failure') {
          clearTimeout(this.timeout); this.pending = null;
          this.worker?.terminate(); this.worker = null;
          if (data.type === 'result') resolve(data.result); else reject(new Error(data.message));
        }
      };
      this.worker.onerror = event => {
        event.preventDefault(); const message = ready ? '运行器遇到问题，请重试。' : 'Python 运行环境加载失败。请确认资源文件完整，再重试。';
        fail(message);
      };
      this.worker.postMessage({ type: 'run', payload: { code, level } });
    });
  }
  stop() {
    clearTimeout(this.timeout); this.worker?.terminate(); this.worker = null;
    if (this.pending) { this.pending.reject(new DOMException('已停止运行。', 'AbortError')); this.pending = null; }
  }
  dispose() { this.stop(); }
}
