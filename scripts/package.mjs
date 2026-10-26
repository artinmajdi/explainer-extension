import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
await mkdir('artifacts', {recursive:true});
await rm('artifacts/explainer-1.1.0.zip', {force:true});
execFileSync('/usr/bin/zip', ['-qr', '../artifacts/explainer-1.1.0.zip', '.'], {cwd:'dist'});
console.log('Created artifacts/explainer-1.1.0.zip');
