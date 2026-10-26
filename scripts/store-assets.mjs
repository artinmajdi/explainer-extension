// Capture the real extension's explicitly labeled offline demo. No AI output is fabricated.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const temp = await mkdtemp(path.join(tmpdir(), 'explainer-store-'));
const extension = path.join(temp, 'extension');
await cp('dist', extension, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
manifest.host_permissions.push('http://127.0.0.1/*');
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Field Notes — Photosynthesis</title><style>
body{margin:0;background:#fbfaf6;color:#25392d;font:20px/1.8 Georgia,serif}nav{font:12px sans-serif;letter-spacing:2px;border-bottom:1px solid #dce3d5;padding:24px 7%}main{width:560px;margin:55px 7%}h1{font-size:54px;line-height:1.1;font-weight:400;letter-spacing:-2px}small{font:11px sans-serif;letter-spacing:2px;color:#708b59}aside{margin-top:50px;font:13px/1.7 sans-serif;color:#61745c}p{max-width:540px}</style></head><body><nav>FIELD NOTES / THE LIVING WORLD</nav><main><small>SCIENCE, A LITTLE CLOSER</small><h1>Every leaf is a<br>small beginning.</h1><p id="selection">Photosynthesis converts light energy into chemical energy stored in glucose, using carbon dioxide and water while releasing oxygen as a byproduct.</p><p>A plant’s leaves contain chlorophyll, a pigment that absorbs light. This helps the plant turn simple ingredients into the energy it needs to grow.</p><aside>Explainer • Offline demo preview<br>This screenshot shows the extension’s built-in sample explanation.</aside></main></body></html>`;
const server = createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let context;
try {
context = await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,viewport:{width:1280,height:800},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
let [worker] = context.serviceWorkers(); if(!worker) worker=await context.waitForEvent('serviceworker');
const id = new URL(worker.url()).hostname;
const options = await context.newPage(); await options.goto(`chrome-extension://${id}/options.html`);
await options.locator('#demo').check(); await options.locator('#settings-form').evaluate(f=>f.requestSubmit());
await options.locator('#status').filter({hasText:'Saved.'}).waitFor();
const page = await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.locator('#selection').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);});
await page.locator('#explainer-root').getByText('How a plant makes its own food',{exact:true}).waitFor();
await page.screenshot({path:'store/assets/demo-1280x800.png'});
await page.locator('#explainer-root .body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
await page.screenshot({path:'store/assets/diagram-1280x800.png'});
const promo = await context.newPage(); await promo.setViewportSize({width:440,height:280});
await promo.setContent(`<body style="margin:0;background:#193d2e;color:#f4f4e6;font-family:Arial,sans-serif"><main style="padding:32px"><div style="font-size:19px;color:#c6e4a4">✦ &nbsp; EXPLAINER</div><h1 style="font-size:36px;line-height:1.1;letter-spacing:-1px;margin:24px 0 16px">Understand<br>what you read.</h1><p style="font-size:14px;line-height:1.5;color:#d6dfd5">Select text. Find clarity.<br>Powered by on-device Gemini Nano.</p></main></body>`);
await promo.screenshot({path:'store/assets/promo-440x280.png'});
} finally { await context?.close(); await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true}); }
