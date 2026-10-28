import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const destination = resolve('public/runtime/python');
await mkdir(destination, { recursive: true });
for (const file of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await copyFile(resolve('node_modules/pyodide', file), resolve(destination, file));
}
console.log('Python 运行环境已准备，可离线使用。');
