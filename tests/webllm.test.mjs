import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('WebLLM setup, inference, model switching, cancellation and deletion stay local',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'webllm-unit-'));
 const state={cached:new Set(),loads:[],prompts:[],unloads:0,interrupts:0,finish:'stop',delay:0};
 globalThis.__webTest=state;
 const cacheStores=new Map();
 globalThis.chrome={runtime:{getURL:p=>'chrome-extension://test/'+p}};
 globalThis.caches={open:async name=>{if(!cacheStores.has(name))cacheStores.set(name,new Map());const m=cacheStores.get(name);return {match:async key=>m.get(key),put:async(k,v)=>m.set(k,v),keys:async()=>[...m.keys()].map(url=>({url})),delete:async k=>m.delete(typeof k==='string'?k:k.url)};}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}}});
 try{
 await build({entryPoints:['src/webllm.ts'],outfile:path.join(dir,'engine.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'fake-gpu-model',setup(b){b.onResolve({filter:/^@mlc-ai\/web-llm$/},()=>({path:'mock',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`
 const s=globalThis.__webTest;
 export const hasModelInCache=async id=>s.cached.has(id);
 export class MLCEngine {
 constructor(config){s.config=config;this.chat={completions:{create:async request=>{s.prompts.push(request);if(s.delay)await new Promise(r=>setTimeout(r,s.delay));return {choices:[{finish_reason:s.finish,message:{content:JSON.stringify({title:'Local',simple:'A clear explanation.',ideas:[],example:'',terms:[],diagram:[],imageQuery:''})}}]};}}};}
 async reload(id){s.loads.push(id);s.cached.add(id);s.config.initProgressCallback({text:'Downloading test model'});}
 async unload(){s.unloads++;}
 async interruptGenerate(){s.interrupts++;}
 }
 `,loader:'js'}));}}]});
 const {webTask}=await import(pathToFileURL(path.join(dir,'engine.mjs')));
 const small='Qwen2.5-0.5B-Instruct-q4f16_1-MLC',large='Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
 const settings={webModel:small,language:'Arabic',level:'beginner'};
 const call=(action,overrides={},text='A plant uses light.',signal=new AbortController().signal)=>webTask(action,{...settings,...overrides},text,'','Use easier words',signal,()=>{});
 assert.match(await call('status'),/Not downloaded/);
 await assert.rejects(call('explain'),/Download this WebLLM model/);assert.equal(state.loads.length,0);
 await assert.rejects(call('setup',{webModel:'https://evil.example/model'}),/supported/);
 await call('setup');assert.equal(state.loads.length,1);
 assert.ok(state.config.appConfig.model_list.every(m=>m.model_lib.startsWith('chrome-extension://test/models/')));
 assert.equal((await call('explain')).title,'Local');
 assert.match(state.prompts[0].messages[1].content,/Write in Arabic/);
 assert.equal(state.prompts[0].response_format.type,'json_object');
 await assert.rejects(call('explain',{},'x'.repeat(1801)),/shorter passage/);assert.equal(state.prompts.length,1);
 await call('setup',{webModel:large});assert.equal(state.unloads,1);assert.deepEqual(state.loads,[small,large]);
 state.finish='length';await assert.rejects(call('explain',{webModel:large}),/response space/);state.finish='stop';
 await call('setup');state.delay=40;const controller=new AbortController();const pending=call('explain',{},'Test',controller.signal);setTimeout(()=>controller.abort(),10);await assert.rejects(pending,/cancelled/);assert.equal(state.interrupts,1);state.delay=0;
 const cache=await caches.open('webllm/model');await cache.put(`https://huggingface.co/mlc-ai/${small}/resolve/main/weights.bin`,new Response('data'));await cache.put(`https://huggingface.co/mlc-ai/${large}/resolve/main/weights.bin`,new Response('data'));
 await call('remove');assert.equal((await cache.keys()).length,1);assert.ok((await cache.keys())[0].url.includes(large));assert.match(await call('status'),/Not downloaded/);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});await assert.rejects(call('setup'),/WebGPU is unavailable/);
 }finally{await rm(dir,{recursive:true,force:true});delete globalThis.__webTest;}
});
