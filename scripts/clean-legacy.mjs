import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
let removed = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }

    const ext = extname(full);
    if (ext !== '.jsx' && ext !== '.js') continue;

    const base = full.slice(0, -ext.length);
    const modern = ext === '.jsx'
      ? [base + '.tsx', base + '.ts']
      : [base + '.ts', base + '.tsx'];

    if (modern.some(existsSync)) {
      unlinkSync(full);
      removed += 1;
      console.log(`[clean-legacy] removido arquivo legado: ${full}`);
    }
  }
}

walk(root);
console.log(`[clean-legacy] concluido; ${removed} arquivo(s) legado(s) removido(s).`);
