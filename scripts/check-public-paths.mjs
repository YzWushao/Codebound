import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Scan only tracked files: machine-specific notes belong in ignored .local/.
const names = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const pattern = /(?<![A-Za-z0-9])[A-Za-z]:[\\/]|\/(?:Users|home|mnt)\//;
const found = [];
for (const name of names) {
  const bytes = readFileSync(name);
  if (bytes.includes(0)) continue;
  bytes.toString('utf8').split(/\r?\n/).forEach((line, index) => {
    if (pattern.test(line)) found.push(`${name}:${index + 1}`);
  });
}
if (found.length) {
  console.error(`Remove machine-specific absolute paths from:\n${found.join('\n')}`);
  process.exitCode = 1;
} else console.log('Public repository path check passed.');
