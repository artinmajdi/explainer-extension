import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, cp, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(path.join(tmpdir(),'explainer-test-'));
const extension=path.join(temp,'extension');await cp('dist',extension,{recursive:true});
// Grant ONLY the fixture origin at install time to make headless tests deterministic.
// Production keeps all page access optional; all compiled code is unchanged.
const manifest=JSON.parse(await readFile(path.join(extension,'manifest.json'),'utf8'));
manifest.host_permissions.push('http://127.0.0.1/*');
await writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
await cp('tests/nano-mock.js',path.join(extension,'nano-mock.js'));
const frameHtml=await readFile(path.join(extension,'nano-frame.html'),'utf8');
await writeFile(path.join(extension,'nano-frame.html'),frameHtml.replace('<script type="module"','<script src="nano-mock.js"></script><script type="module"'));
const fixture=await readFile('tests/fixture.html','utf8');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/frame'?'<p id="frame-text">Plants use sunlight to grow.</p>':fixture);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=`http://127.0.0.1:${server.address().port}`;
let browser;
const errors=[];const passed=[];
function pass(label){passed.push(label);console.log('PASS',label);}
async function waitFor(fn,label){for(let i=0;i<80;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+label);}
try{
  browser=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,viewport:{width:1280,height:960},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  let [worker]=browser.serviceWorkers();if(!worker)worker=await browser.waitForEvent('serviceworker');
  const id=new URL(worker.url()).hostname;
  await waitFor(()=>worker.evaluate(async()=> !!chrome.scripting && (await chrome.scripting.getRegisteredContentScripts()).length>0),'script registration');
  const options=await browser.newPage();await options.goto(`chrome-extension://${id}/options.html`);
  options.on('pageerror',e=>errors.push(e.message));
  await options.locator('#key-status').filter({hasText:'No key yet'}).waitFor({state:'attached'});
  await options.screenshot({path:'artifacts/settings.png',fullPage:true});
  pass('settings page loads without credentials');
  const nativeStatus=await options.locator('#nano-status').textContent();console.log('Native Nano status:',nativeStatus);
  assert.equal(await options.locator('#provider').inputValue(),'nano');
  await options.addInitScript({path:'tests/nano-mock.js'});await options.reload();
  await options.locator('#setup-nano').click();await options.locator('#nano-status').filter({hasText:'Gemini Nano is ready.'}).waitFor();
  pass('Nano is default and setup works without a key or cloud consent');
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(address);
  async function select(selector, target=page){await target.locator(selector).evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});}
  const root=page.locator('#explainer-root');
  const network=[];browser.on('request',r=>{if(r.url().includes('googleapis.com')||r.url().includes('wikimedia.org'))network.push(r.url());});
  await select('#selection');await root.getByText('Local Nano explanation',{exact:true}).waitFor();
  await root.getByText('GEMINI NANO · ON YOUR DEVICE',{exact:true}).waitFor();assert.deepEqual(network,[]);
  pass('Nano routes through offscreen iframe and renders locally without cloud requests');
  const local=await options.evaluate(()=>chrome.runtime.sendMessage({target:'nanoMock'}));assert.equal(local.prompts,local.destroyed);
  await page.keyboard.press('Escape');
  console.log('Mock state:',await options.evaluate(()=>chrome.runtime.sendMessage({target:'nanoMock',state:'unavailable'})));
  await select('#second');await root.getByText('Gemini Nano is unavailable',{exact:false}).waitFor();assert.deepEqual(network,[]);
  pass('unavailable Nano reports an error without cloud fallback');
  await page.keyboard.press('Escape');
  await options.evaluate(()=>chrome.runtime.sendMessage({target:'nanoMock',state:'downloadable'}));
  await select('#selection');await root.getByText('Gemini Nano needs a model download.',{exact:false}).waitFor();assert.deepEqual(network,[]);
  pass('model download requires setup rather than automatic activation');
  await page.keyboard.press('Escape');
  await options.locator('#provider').selectOption('cloud');await options.locator('#settings-form').evaluate(form=>form.requestSubmit());
  await waitFor(()=>worker.evaluate(async()=> (await chrome.storage.local.get('settings')).settings.provider==='cloud'),'cloud opt-in');
  await select('#selection');await root.getByText('LET’S GET STARTED').waitFor();pass('missing consent opens actionable setup without AI call');
  await page.keyboard.press('Escape');await root.waitFor({state:'detached'});
  await options.locator('#demo').check();await options.locator('#settings-form').evaluate(form=>form.requestSubmit());
  await options.locator('#status').filter({hasText:'Saved.'}).waitFor();
  await select('#selection');await root.getByText('How a plant makes its own food',{exact:true}).waitFor();
  await root.getByText('OFFLINE DEMO', {exact:false}).waitFor();
  assert.equal(await root.locator('.flow li').count(),3);
  const style=await root.locator('button').first().evaluate(e=>getComputedStyle(e).fontSize);assert.notEqual(style,'70px');
  assert.ok((await root.locator('.panel').evaluate(e=>getComputedStyle(e).fontFamily)).includes('sans-serif'));
  pass('actual content script renders labeled demo, structured diagram, and isolated styles');
  await page.screenshot({path:'artifacts/extension-demo.png'});
  await root.getByRole('button',{name:'Pin',exact:true}).click();await select('#second');
  await page.waitForTimeout(750);assert.equal(await root.locator('.quote').textContent(),await page.locator('#selection').textContent());
  pass('pin preserves the current explanation');await page.keyboard.press('Escape');
  // Mock the provider at the service-worker network boundary, with no real credentials.
  await worker.evaluate(()=>{
    globalThis.__originalFetch=globalThis.fetch;globalThis.__requests=[];
    globalThis.fetch=async(url,options)=>{
      globalThis.__requests.push({url:String(url),body:options?.body});
      if(String(url).includes('commons.wikimedia.org'))return new Response(JSON.stringify({query:{pages:globalThis.__pictures?{'1':{title:'File:Leaf.png',imageinfo:[{thumburl:'https://upload.wikimedia.org/test-leaf.png',descriptionurl:'https://commons.wikimedia.org/wiki/File:Leaf.png',extmetadata:{Artist:{value:'<b>Example artist</b>'},LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'}}}]}}:{}}}));
      const body=JSON.parse(options.body);const input=JSON.parse(body.contents[0].parts[0].text);
      if(input.source.includes('rate-limit'))return new Response('{}',{status:429});
      const slow=input.source.includes('SLOW');await new Promise(r=>setTimeout(r,slow?1600:60));
      const result={title:input.source.includes('onerror')?'<img src=x onerror=alert(1)>':slow?'Old response':'A clear explanation',simple:'A plant uses sunlight to turn water and carbon dioxide into sugar.',ideas:['Sunlight provides energy.'],example:'A leaf works like a solar-powered kitchen.',terms:[],diagram:[{label:'Light',detail:'Absorbed by leaves'},{label:'Sugar',detail:'Stores energy'}],imageQuery:'photosynthesis'};
      return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]}));
    };
  });
  await options.locator('#demo').uncheck();await options.locator('#consent').check();await options.locator('#images').check();await options.locator('#api-key').fill('test-key-not-real');
  await options.locator('#settings-form').evaluate(form=>form.requestSubmit());await options.locator('#status').filter({hasText:'Saved.'}).waitFor();
  // Wait until saved state reflects the new mode (status may contain the prior save).
  await waitFor(()=>worker.evaluate(async()=>!(await chrome.storage.local.get('settings')).settings.demo),'demo disabled');
  await select('#selection');await root.getByText('A clear explanation',{exact:true}).waitFor();await root.getByText('No suitable picture found.').waitFor();
  const sent=await worker.evaluate(()=>globalThis.__requests);assert.equal(JSON.parse(JSON.parse(sent[0].body).contents[0].parts[0].text).source,await page.locator('#selection').textContent());
  pass('real Gemini request pipeline renders validated JSON and graceful image fallback');
  await root.getByRole('button',{name:'Simpler',exact:true}).click();await root.getByText('A clear explanation',{exact:true}).waitFor();
  assert.ok((await worker.evaluate(()=>globalThis.__requests)).some(x=>x.body?.includes('easier words')));pass('refinement sends requested reading instruction');
  await browser.route('https://upload.wikimedia.org/test-leaf.png',route=>route.fulfill({contentType:'image/png',path:'public/icons/icon128.png'}));
  await worker.evaluate(()=>{globalThis.__pictures=true;});
  await root.getByRole('button',{name:'More detail',exact:true}).click();await root.getByRole('link',{name:'Leaf.png',exact:true}).waitFor();
  await waitFor(()=>root.locator('figure img').evaluate(e=>e.complete&&e.naturalWidth>0),'picture loaded');
  assert.equal(await root.locator('figcaption b').count(),0);await root.getByText('Example artist · CC BY 4.0',{exact:true}).waitFor();
  pass('picture rendering includes sanitized attribution, source, and license');
  await worker.evaluate(()=>{globalThis.__pictures=false;});

  await page.keyboard.press('Escape');await select('#malicious');await root.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();assert.equal(await root.locator('h2 img').count(),0);pass('untrusted model markup renders as inert text');
  await page.keyboard.press('Escape');await page.locator('#dynamic').evaluate(e=>e.textContent='SLOW response');await select('#dynamic');await root.getByText('Finding a simpler way to explain this…').waitFor();
  await select('#second');await root.getByText('A clear explanation',{exact:true}).waitFor();await page.waitForTimeout(1800);assert.equal(await root.locator('h2').textContent(),'A clear explanation');pass('rapid reselection cannot be overwritten by a stale response');
  await page.keyboard.press('Escape');await page.locator('#dynamic').evaluate(e=>e.textContent='rate-limit');await select('#dynamic');await root.getByText('Gemini quota or rate limit reached.',{exact:false}).waitFor();pass('rate-limit errors offer recovery');
  await page.keyboard.press('Escape');await page.locator('#dynamic').evaluate(e=>e.textContent='x'.repeat(24001));const before=await worker.evaluate(()=>globalThis.__requests.length);await select('#dynamic');await root.getByText('Nothing was sent.',{exact:false}).waitFor();assert.equal(await worker.evaluate(()=>globalThis.__requests.length),before);pass('oversize selections are rejected without network transmission');
  await page.keyboard.press('Escape');await page.locator('#dynamic').evaluate(e=>e.textContent='');await page.locator('#editable').focus();await page.locator('#editable').press('ControlOrMeta+A');await page.waitForTimeout(800);assert.equal(await root.count(),0);pass('editable input is excluded');
  await page.locator('h1').click();await select('#second');await root.getByText('A clear explanation',{exact:true}).waitFor();await page.setViewportSize({width:400,height:500});await page.waitForTimeout(150);const box=await root.locator('.panel').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=400&&box.y+box.height<=500);pass('popup fits a narrow resized viewport');
  await page.setViewportSize({width:1280,height:960});await page.keyboard.press('Escape');
  await options.locator('#mode').selectOption('click');await options.locator('#settings-form').evaluate(form=>form.requestSubmit());await waitFor(()=>worker.evaluate(async()=> (await chrome.storage.local.get('settings')).settings.mode==='click'),'click mode');
  await page.locator('#selection').scrollIntoViewIfNeeded();await select('#selection');await root.getByRole('button',{name:'Explain',exact:false}).waitFor();assert.equal(await root.locator('.panel').count(),0);await root.getByRole('button',{name:'Explain',exact:false}).click();await root.getByText('A clear explanation',{exact:true}).waitFor();pass('click-to-explain mode waits for explicit action');
  await page.keyboard.press('Escape');const frame=page.frames().find(f=>f.url().endsWith('/frame'));await select('#frame-text',frame);await frame.locator('#explainer-root').getByRole('button',{name:'Explain',exact:false}).waitFor();pass('permitted iframe selections work');
  await options.locator('#enabled').uncheck();await options.locator('#settings-form').evaluate(form=>form.requestSubmit());await waitFor(()=>worker.evaluate(async()=>!(await chrome.storage.local.get('settings')).settings.enabled),'paused');await page.waitForTimeout(150);await select('#selection');await page.waitForTimeout(750);assert.equal(await root.count(),0);pass('global pause suppresses popups');
  assert.deepEqual(errors,[]);pass('no uncaught page errors');
  await writeFile('artifacts/test-report.json',JSON.stringify({passed,errors,providers:'Cloud fetch and local LanguageModel API mocked; native availability checked separately',nativeNanoStatus:nativeStatus,productionCode:'unchanged',fixturePermission:'http://127.0.0.1/*'},null,2));
}catch(error){for(const p of browser?.pages()||[]){if(p.url().startsWith(address))console.log('Browser failure state:',await p.locator('#explainer-root').innerText().catch(()=>'<no popup>'));}throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
