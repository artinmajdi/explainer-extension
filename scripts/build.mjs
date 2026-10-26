import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
const common = { bundle: true, target: 'chrome120', sourcemap: false, logLevel: 'info' };
const jobs = [
  { ...common, entryPoints: ['src/content.ts'], outfile: 'dist/content.js', format: 'iife' },
  { ...common, entryPoints: ['src/background.ts', 'src/options.ts', 'src/popup.ts', 'src/offscreen.ts', 'src/nano-frame.ts'], outdir: 'dist', format: 'esm' }
];
if (process.argv.includes('--watch')) {
  for (const job of jobs) { const ctx = await context(job); await ctx.watch(); }
} else { await Promise.all(jobs.map(job => build(job))); }
