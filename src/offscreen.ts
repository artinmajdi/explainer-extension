import type { explainNano } from './nano';
// Keep the window-only Prompt API in a same-origin iframe, isolated from web pages.
const iframe=document.createElement('iframe');
iframe.allow='language-model';iframe.src=chrome.runtime.getURL('nano-frame.html');
const frameReady=new Promise<void>((resolve,reject)=>{iframe.onload=()=>resolve();iframe.onerror=()=>reject(new Error('Could not open the local AI document.'));});
document.body.append(iframe);
chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='nano-inference' || port.sender?.id!==chrome.runtime.id || port.sender?.tab)return;
  const controller=new AbortController();let started=false;
  const post=(value:unknown)=>{if(!controller.signal.aborted)try{port.postMessage(value);}catch{controller.abort();}};
  // Progress messages also keep the worker's routing connection active during local inference.
  const pulse=setInterval(()=>post({type:'progress',message:'Gemini Nano is still working on your device…'}),20000);
  port.onDisconnect.addListener(()=>{controller.abort();clearInterval(pulse);});
  port.onMessage.addListener(async message=>{
    if(started)return;started=true;
    try{
      await frameReady;controller.signal.throwIfAborted();
      const run=(iframe.contentWindow as Window & {explainNano:typeof explainNano}).explainNano;
      if(!run)throw new Error('Local AI did not initialize. Reload the extension and retry.');
      const result=await run(message.settings,message.text,message.context,message.refinement,
        AbortSignal.any([controller.signal,AbortSignal.timeout(180000)]),text=>post({type:'progress',message:text}));
      post({type:'result',explanation:result});
    }catch(error){
      // Errors thrown by the iframe have a different realm's Error constructor.
      const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message.slice(0,1000) : 'Local AI failed. Please retry.';
      post({type:'error',message});
    }
    finally{clearInterval(pulse);}
  });
});
