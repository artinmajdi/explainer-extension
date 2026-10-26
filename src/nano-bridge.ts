import type { Settings, Explanation } from './core';
let creating:Promise<void>|undefined;
async function ensureDocument(){
  if(creating)return creating;
  creating=(async()=>{
    if(!await chrome.offscreen.hasDocument())await chrome.offscreen.createDocument({url:'offscreen.html',reasons:[chrome.offscreen.Reason.IFRAME_SCRIPTING],justification:'Host and script a same-origin iframe running the window-only Gemini Nano Prompt API for local text explanations.'});
  })();
  try{await creating;}finally{creating=undefined;}
}
export async function runNano(settings:Settings,text:string,context:string,refinement:string,signal:AbortSignal,progress:(text:string)=>void):Promise<Explanation>{
  await ensureDocument();signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const port=chrome.runtime.connect({name:'nano-inference'});let finished=false;
    const finish=(error?:Error,value?:Explanation)=>{if(finished)return;finished=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);port.disconnect();if(error)reject(error);else resolve(value!);};
    const abort=()=>finish(new Error('Local explanation cancelled.'));
    const timeout=setTimeout(()=>finish(new Error('Gemini Nano timed out. Try a shorter selection.')),190000);
    signal.addEventListener('abort',abort,{once:true});
    port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;finish(new Error('Local AI connection was interrupted. Retry to reconnect.'));});
    port.onMessage.addListener(message=>{
      if(message.type==='progress')progress(message.message);
      if(message.type==='result')finish(undefined,message.explanation);
      if(message.type==='error')finish(new Error(message.message));
    });
    port.postMessage({settings,text,context,refinement});
  });
}
