import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(path.join(tmpdir(),'explainer-web-'));
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><h1>Local model test</h1><p id="selected">Photosynthesis lets plants use sunlight to make sugar.</p>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 const extension=path.join(temp,'extension');await cp('dist',extension,{recursive:true});
 const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));assert.ok(manifest.permissions.includes('activeTab')); assert.ok(manifest.host_permissions.includes('http://*/*')); assert.ok(manifest.host_permissions.includes('https://*/*'));await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
 browser=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,viewport:{width:1280,height:900},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 let [worker]=browser.serviceWorkers();if(!worker)worker=await browser.waitForEvent('serviceworker');
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options.html`);
 await page.locator('#key-status').filter({hasText:'No key yet'}).waitFor({state:'attached'});
 await page.locator('#provider').selectOption('webllm');
 assert.equal(await page.locator('#web-model option').count(),2);
 await page.locator('#web-languages').filter({hasText:'Arabic'}).waitFor();
 await page.locator('#web-model').selectOption('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
 await page.locator('#web-languages').filter({hasText:'Japanese'}).waitFor();
 await page.locator('#settings-form').evaluate(f=>f.requestSubmit());
 await page.locator('#status').filter({hasText:'Saved.'}).waitFor();await page.reload();
 await page.locator('#key-status').filter({hasText:'No key yet'}).waitFor({state:'attached'});
 assert.equal(await page.locator('#provider').inputValue(),'webllm');
 assert.equal(await page.locator('#web-model').inputValue(),'Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
 await page.locator('#check-web').click();
 await page.waitForFunction(()=>!document.getElementById('check-web').disabled);
 const state=await page.locator('#web-status').textContent();console.log('Real WebLLM import / GPU status:',state);
 assert.match(state,/Not downloaded|WebGPU is unavailable|No compatible GPU|shader-f16/);
 await page.locator('#webllm-settings').screenshot({path:'artifacts/webllm-settings.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS model choices, immediate language updates, saved model persistence, production CSP/import and real GPU check');
 const preflight=await browser.newPage();await preflight.goto(`http://127.0.0.1:${server.address().port}`);
 await preflight.locator('#selected').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);});
 try{await preflight.locator('#explainer-root').getByText('Download this WebLLM model in Settings first.',{exact:false}).waitFor({timeout:15000});}catch(e){console.log('Preflight popup:',await preflight.locator('#explainer-root').evaluate(el=>el.shadowRoot.querySelector('.panel').innerText).catch(()=>'<no popup>'));throw e;}
 await preflight.close();console.log('PASS webpage routes to WebLLM with actionable setup error');
 if(process.env.WEBLLM_REAL_TEST==='1'){
  page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text().slice(0,250));});
  if(process.env.WEBLLM_TEST_MODEL){await page.locator('#web-model').selectOption(process.env.WEBLLM_TEST_MODEL);await page.locator('#settings-form').evaluate(f=>f.requestSubmit());await page.locator('#status').filter({hasText:'Saved.'}).waitFor();}
  await page.locator('#setup-web').click();
  await page.waitForFunction(()=>!document.getElementById('setup-web').disabled,{},{timeout:600000});
  const setup=await page.locator('#web-status').textContent();console.log('Real model setup:',setup);assert.match(setup,/Model is ready/);
  const result=await page.evaluate(async()=>{
   const settings=(await chrome.storage.local.get('settings')).settings;
   return new Promise(resolve=>{const p=chrome.runtime.connect({name:'webllm-inference'});p.onMessage.addListener(m=>{if(m.type==='result'||m.type==='error'){p.disconnect();resolve(m);}});p.postMessage({action:'explain',settings,text:'Photosynthesis lets plants use sunlight to make sugar.',context:'',refinement:''});});
  });console.log('Real local generation:',JSON.stringify(result));assert.equal(result.type,'result');assert.ok(result.result.simple);
  const fixture=await browser.newPage();await fixture.goto(`http://127.0.0.1:${server.address().port}`);
  // Recreate the local host, then run offline to prove weights/config/tokenizer are cached.
  await worker.evaluate(()=>chrome.offscreen.closeDocument());await browser.setOffline(true);
  await fixture.locator('#selected').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);});
  try{await fixture.locator('#explainer-root').getByText('WEBLLM · ON YOUR DEVICE',{exact:true}).waitFor({timeout:180000});}catch(e){console.log('Popup state:',await fixture.locator('#explainer-root').evaluate(el=>el.shadowRoot.querySelector('.panel').innerText).catch(()=>'<no popup>'));throw e;}
  await fixture.screenshot({path:'artifacts/webllm-real-explanation.png'});
  console.log('PASS actual selected-text → background → offscreen WebLLM → popup, with offline cached reload');
  await page.locator('#remove-web').click();await page.waitForFunction(()=>!document.getElementById('remove-web').disabled);
  assert.match(await page.locator('#web-status').textContent(),/Downloaded model removed/);
  await page.locator('#check-web').click();await page.waitForFunction(()=>!document.getElementById('check-web').disabled);
  assert.match(await page.locator('#web-status').textContent(),/Not downloaded/);
  console.log('PASS real cache removal without network');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
