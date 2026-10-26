import {ensureDocument} from './nano-bridge';
import type {Settings,Explanation} from './core';
export function webRequest(action:string,settings:Settings,signal:AbortSignal,progress:(s:string)=>void,text='',context='',refinement=''):Promise<any>{
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const port=chrome.runtime.connect({name:'webllm-inference'});let done=false;
    const finish=(error?:Error,result?:unknown)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);port.disconnect();error?reject(error):resolve(result);};
    const abort=()=>finish(new Error('WebLLM operation cancelled.'));
    const timer=setTimeout(()=>finish(new Error('WebLLM timed out. Retry setup or select a shorter passage.')),action==='setup'?1800000:300000);
    signal.addEventListener('abort',abort,{once:true});
    port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;finish(new Error('Local model connection interrupted. Please retry.'));});
    port.onMessage.addListener(m=>{if(m.type==='progress')progress(m.message);if(m.type==='result')finish(undefined,m.result);if(m.type==='error')finish(new Error(m.message));});
    port.postMessage({action,settings,text,context,refinement});
  });
}
export async function runWebLLM(s:Settings,text:string,context:string,refinement:string,signal:AbortSignal,progress:(s:string)=>void):Promise<Explanation>{
  await ensureDocument();
  return webRequest('explain',s,signal,progress,text,context,refinement);
}
