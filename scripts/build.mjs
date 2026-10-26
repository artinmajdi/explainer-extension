import {createHash} from 'node:crypto';
import { build, context } from 'esbuild';
import { cp, mkdir, rm, readFile } from 'node:fs/promises';
// Verify bundled executable libraries against the recorded upstream hashes.
for(const record of JSON.parse(await readFile('public/models/sources.json','utf8'))){
  const bytes=await readFile(`public/models/${record.file}`);
  if(createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw new Error(`Model library checksum mismatch: ${record.file}`);
}
await rm('dist', {recursive:true,force:true});
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
// WebLLM's tokenizer contains an unreachable Node-only URL branch in browser builds.
const browserOnly = {name:'browser-only-url',setup(b){b.onResolve({filter:/^url$/},()=>({path:'url',namespace:'browser-only'}));b.onLoad({filter:/.*/,namespace:'browser-only'},()=>({contents:'export function pathToFileURL(){throw new Error("Node URL API is unavailable in the browser");}',loader:'js'}));}};
const common = { bundle: true, target: 'chrome120', sourcemap: false, plugins:[browserOnly], logLevel: 'info' };
const jobs = [
  { ...common, entryPoints: ['src/content.ts'], outfile: 'dist/content.js', format: 'iife' },
  { ...common, entryPoints: ['src/background.ts', 'src/options.ts', 'src/popup.ts', 'src/offscreen.ts', 'src/nano-frame.ts'], outdir: 'dist', format: 'esm', splitting:true }
];
if (process.argv.includes('--watch')) {
  for (const job of jobs) { const ctx = await context(job); await ctx.watch(); }
} else { await Promise.all(jobs.map(job => build(job))); }
