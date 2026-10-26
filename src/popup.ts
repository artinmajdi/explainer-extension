const node=(id:string)=>document.getElementById(id)!;
const show=(text:string,error=false)=>{node('status').textContent=text;node('status').className=error?'error':'';};
async function send(message:unknown){const r=await chrome.runtime.sendMessage(message);if(!r.ok)throw new Error(r.error);return r;}
async function load(){
  const r=await send({type:'status'});const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const host=tab?.url && /^https?:/.test(tab.url)?new URL(tab.url).hostname:'';
  node('state').textContent=!r.settings.enabled?'Paused':r.settings.demo?'Demo':r.settings.provider==='nano'?'Nano':r.settings.provider==='webllm'?'WebLLM':r.hasKey?'Cloud':'Set up';
  node('toggle').textContent=r.settings.enabled?'Pause everywhere':'Resume everywhere';
  node('toggle-site').textContent=r.settings.disabledSites.includes(host)?'Enable on this site':'Disable on this site';
  if(r.settings.provider==='nano'&&!r.settings.demo)show('On-device explanations. Set up Gemini Nano in Settings first.');
  if(r.settings.provider==='webllm'&&!r.settings.demo)show('On-device WebLLM explanations. Download your chosen model in Settings first.');
  if(r.settings.provider==='cloud'&&!r.hasKey&&!r.settings.demo)show('Add your Gemini key in Settings to begin.');
}
node('settings').addEventListener('click',()=>void chrome.runtime.openOptionsPage());
node('activate').addEventListener('click',async()=>{try{await send({type:'activate'});window.close();}catch(e){show((e as Error).message,true);}});
node('toggle').addEventListener('click',async()=>{try{await send({type:'toggle'});await load();}catch(e){show((e as Error).message,true);}});
node('toggle-site').addEventListener('click',async()=>{try{await send({type:'toggleSite'});await load();}catch(e){show((e as Error).message,true);}});
node('grant-site').addEventListener('click',async()=>{
  try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.url || !/^https?:/.test(tab.url))throw new Error('Open a normal webpage first.');
    const url=new URL(tab.url);const ok=await chrome.permissions.request({origins:[`${url.protocol}//${url.hostname}/*`]});
    show(ok?'Site enabled. Reload the page to start automatic selection explanations.':'Site access was not granted.');
  }catch(e){show((e as Error).message,true);}
});
void load().catch(e=>show(e.message,true));
