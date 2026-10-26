import test from 'node:test';
import assert from 'node:assert/strict';
import { splitText, MAX_TEXT, cleanSettings, validateExplanation, safeHttps, position, defaults } from '../src/core.ts';
import { demoExplanation, explain, generate } from '../src/provider.ts';

test('long selections retain all content and reject oversize before sending',()=>{
  const input=('Photosynthesis stores energy. '.repeat(500)).trim();
  const chunks=splitText(input);assert.ok(chunks.length>1);
  assert.equal(chunks.join(' ').replace(/\s+/g,' '),input.replace(/\s+/g,' '));
  assert.ok(chunks.every(x=>x.length<=6000));
  assert.throws(()=>splitText('a'.repeat(MAX_TEXT+1)),/Nothing has been sent/);
  assert.throws(()=>splitText('   '),/Select some text/);
  assert.equal(splitText('🌱'.repeat(4000)).join(''),'🌱'.repeat(4000));
});
test('model and settings inputs cannot redirect the provider',()=>{
  const s=cleanSettings({model:'../../evil',mode:'bad' as any,theme:'bad' as any,disabledSites:['example.com',5 as any]});
  assert.equal(s.model,defaults.model);assert.equal(s.mode,'auto');assert.equal(s.theme,'system');assert.deepEqual(s.disabledSites,['example.com']);
});
test('structured responses enforce bounds but leave markup as inert text',()=>{
  const response=demoExplanation();response.title='<img src=x onerror=alert(1)>';
  assert.equal(validateExplanation(response).title,response.title);
  assert.throws(()=>validateExplanation({...response,ideas:'wrong'}));
  assert.throws(()=>validateExplanation({...response,simple:''}));
  assert.throws(()=>validateExplanation({...response,terms:[null]}));
  assert.throws(()=>validateExplanation({...response,diagram:Array(7).fill({label:'x',detail:'y'})}));
});
test('untrusted image URLs are restricted to HTTPS on approved hosts',()=>{
  assert.equal(safeHttps('javascript:alert(1)',['upload.wikimedia.org']),'');
  assert.equal(safeHttps('https://upload.wikimedia.org.evil.test/x',['upload.wikimedia.org']),'');
  assert.equal(safeHttps('https://evil.test@upload.wikimedia.org/x',['upload.wikimedia.org']),'');
  assert.equal(safeHttps('https://upload.wikimedia.org/x',['upload.wikimedia.org']),'https://upload.wikimedia.org/x');
});
test('popup stays within the viewport at the bottom-right edge',()=>{
  const p=position({left:1200,top:850,bottom:900},430,550,{width:1280,height:900});
  assert.equal(p.left,838);assert.equal(p.top,338);
});
test('provider handles rate limits without exposing credentials',async()=>{
  const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:429});
  try{await assert.rejects(generate('secret',defaults,'hello','',new AbortController().signal),/quota or rate limit/);}finally{globalThis.fetch=old;}
});
test('chunk processing covers every part then synthesizes once',async()=>{
  const old=globalThis.fetch;const calls:any[]=[];const progress:string[]=[];
  globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(options!.body as string));return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(demoExplanation())}]}}]}));};
  try{
    await explain('secret',defaults,'word '.repeat(2600),'','',new AbortController().signal,x=>progress.push(x));
    assert.equal(calls.length,4);assert.equal(progress.length,4);
    assert.ok(calls[3].contents[0].parts[0].text.includes('consecutive parts'));
  }finally{globalThis.fetch=old;}
});
test('invalid JSON and interrupted generation give useful errors',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{'}]}}]}));
  try{await assert.rejects(generate('secret',defaults,'hello','',new AbortController().signal),/shorter selection/);}finally{globalThis.fetch=old;}
});
