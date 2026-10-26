import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, cleanSettings } from '../src/core.ts';
import { nanoAvailability, setupNano, explainNano, nanoOptions } from '../src/nano.ts';
import { demoExplanation } from '../src/provider.ts';
const global=globalThis as any;
test('old settings migrate to Nano; only explicit cloud opts in',()=>{
  assert.equal(cleanSettings({}).provider,'nano');assert.equal(cleanSettings({provider:'cloud'}).provider,'cloud');
});
test('absent and downloadable APIs do not trigger inference or a cloud fallback',async()=>{
  const old=global.LanguageModel;delete global.LanguageModel;
  try{
    assert.equal(await nanoAvailability(defaults),'unavailable');
    await assert.rejects(explainNano(defaults,'hello','','',new AbortController().signal,()=>{}),/unavailable/);
    global.LanguageModel={availability:async()=> 'downloadable',create:()=>{throw new Error('must not download from inference');}};
    await assert.rejects(explainNano(defaults,'hello','','',new AbortController().signal,()=>{}),/model download/);
  }finally{global.LanguageModel=old;}
});
test('setup creates from user activation, reports progress, and frees session',async()=>{
  const old=global.LanguageModel;let destroyed=false;let value=0;
  global.LanguageModel={create:async(options:any)=>{options.monitor({addEventListener:(_name:string,listener:Function)=>listener({loaded:.6})});return {destroy(){destroyed=true;}};}};
  try{await setupNano(defaults,x=>value=x,new AbortController().signal);assert.equal(value,60);assert.equal(destroyed,true);}finally{global.LanguageModel=old;}
});
test('local inference validates structured JSON and destroys every chunk session',async()=>{
  const old=global.LanguageModel;let created=0,destroyed=0;const calls:any[]=[];
  global.LanguageModel={availability:async()=> 'available',create:async(options:any)=>{created++;return {contextWindow:16000,measureContextUsage:async()=>500,prompt:async(text:string,opts:any)=>{calls.push({text,opts,options});return JSON.stringify(demoExplanation());},destroy(){destroyed++;}};}};
  try{
    const result=await explainNano(defaults,'word '.repeat(1400),'','Use simple words',new AbortController().signal,()=>{});
    assert.ok(result.simple);assert.equal(created,5);assert.equal(destroyed,5);assert.equal(calls[0].opts.responseConstraint.type,'object');
  }finally{global.LanguageModel=old;}
});
test('local context overflow stops before inference and still releases resources',async()=>{
  const old=global.LanguageModel;let destroyed=false;
  global.LanguageModel={availability:async()=> 'available',create:async()=>({contextWindow:1000,measureContextUsage:async()=>900,prompt:()=>{throw new Error('should not prompt');},destroy(){destroyed=true;}})};
  try{await assert.rejects(explainNano(defaults,'hello','','',new AbortController().signal,()=>{}),/context budget/);assert.ok(destroyed);}finally{global.LanguageModel=old;}
});
test('language options are consistent and unsupported names fail clearly',()=>{
  assert.deepEqual(nanoOptions({language:'English'}),{expectedOutputs:[{type:'text',languages:['en']}]});
  assert.deepEqual(nanoOptions(defaults),{});assert.throws(()=>nanoOptions({language:'made up language'}),/listed language/);
});
test('WebLLM settings persist only allowlisted model IDs',()=>{
  const settings=cleanSettings({provider:'webllm',webModel:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'});
  assert.equal(settings.provider,'webllm');assert.equal(settings.webModel,'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
  assert.equal(cleanSettings({webModel:'https://untrusted.example/model'}).webModel,defaults.webModel);
  assert.equal(cleanSettings({}).webModel,defaults.webModel);
});
