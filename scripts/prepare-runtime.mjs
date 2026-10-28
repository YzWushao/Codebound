import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const destination = resolve('public/runtime/python');
await mkdir(destination, { recursive: true });
const files = {};
for (const file of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await copyFile(resolve('node_modules/pyodide', file), resolve(destination, file));
  const bytes = await readFile(resolve(destination, file));
  files[file] = { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const { version } = JSON.parse(await readFile(resolve('node_modules/pyodide/package.json'), 'utf8'));
await writeFile(resolve(destination, 'runtime-manifest.json'), JSON.stringify({ schemaVersion: 1, version, files }, null, 2) + '\n');
console.log('Python 运行环境已准备，可离线使用。');
