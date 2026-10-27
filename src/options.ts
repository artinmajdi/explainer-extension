import {webModels,webModel} from './webllm-models';
import {webRequest} from './webllm-bridge';
import { nanoAvailability, setupNano, nanoUnavailable } from './nano';
import { defaults, type Settings } from './core';
const field = (id:string) => document.getElementById(id) as HTMLInputElement;
const status = (text:string,error=false) => {const node=field('status');node.textContent=text;node.className=error?'error':'';};
async function send(message: unknown) {const r=await chrome.runtime.sendMessage(message);if(!r.ok)throw new Error(r.error);return r;}
async function load() {
  const data=await send({type:'status'});const s:Settings=data.settings;
  for(const name of ['enabled','consent','demo','context','images'] as const)field(name).checked=s[name];
  for(const name of ['provider','mode','level','language','theme','model'] as const)field(name).value=s[name];
  field('web-model').value=s.webModel;webModelUI();field('remember').checked=data.persistent;field('disabled-sites').value=s.disabledSites.join('\n');
  field('key-status').textContent=data.hasKey?'Key saved':'No key yet';field('api-key').placeholder=data.hasKey?'Key saved · enter a new key to replace it':'Paste your API key';providerUI(); void checkNano();
}
function read():Settings {
  return {...defaults,provider:field('provider').value as Settings['provider'],enabled:field('enabled').checked,consent:field('consent').checked,demo:field('demo').checked,context:field('context').checked,images:field('images').checked,
    mode:field('mode').value as Settings['mode'],level:field('level').value as Settings['level'],theme:field('theme').value as Settings['theme'],
    webModel:field('web-model').value,language:field('language').value || defaults.language,model:field('model').value.trim(),
    disabledSites:field('disabled-sites').value.split('\n').map(x=>x.trim().toLowerCase()).filter(Boolean)};
}
document.getElementById('settings-form')!.addEventListener('submit',async event=>{
  event.preventDefault();const save=field('save');save.disabled=true;
  try {await send({type:'save',settings:read(),apiKey:field('api-key').value,remember:field('remember').checked});field('api-key').value='';await load();status('Saved. Reload existing tabs after enabling website access.');}catch(e){status((e as Error).message,true);}finally{save.disabled=false;}
});
field('show-key').addEventListener('click',()=>{const input=field('api-key');input.type=input.type==='password'?'text':'password';field('show-key').textContent=input.type==='password'?'Show':'Hide';});
field('remove-key').addEventListener('click',async()=>{try{await send({type:'removeKey'});await load();status('API key removed.');}catch(e){status((e as Error).message,true);}});
field('test-key').addEventListener('click',async()=>{const button=field('test-key');button.disabled=true;status('Testing your saved key and model with a short sample…');try{await send({type:'test'});status('Connected. Gemini returned a valid explanation.');}catch(e){status((e as Error).message,true);}finally{button.disabled=false;}});
void load().catch(e=>status(e.message,true));

let download:AbortController|null=null;
function providerUI(){field('webllm-settings').hidden=field('provider').value!=='webllm';field('cloud-settings').hidden=field('provider').value!=='cloud';field('nano-settings').hidden=field('provider').value!=='nano';}
async function checkNano(){
  if(download)return;
  try{const state=await nanoAvailability({language:field('language').value});
    field('nano-status').textContent=({available:'Gemini Nano is ready on this device. No API key required.',downloadable:'Your device supports Gemini Nano. Click Set up to download the model.',downloading:'Chrome is downloading Gemini Nano. Click Set up to watch progress.',unavailable:nanoUnavailable})[state];
  }catch(e){field('nano-status').textContent=(e as Error).message;}
}
field('provider').addEventListener('change',providerUI);
field('check-nano').addEventListener('click',()=>void checkNano());
field('setup-nano').addEventListener('click',async()=>{
  download=new AbortController();field('setup-nano').disabled=true;field('cancel-nano').hidden=false;
  const progress=document.getElementById('nano-progress') as HTMLProgressElement;progress.hidden=false;progress.removeAttribute('value');
  field('nano-status').textContent='Preparing Gemini Nano. Keep this settings tab open during the download…';
  try{
    await setupNano({language:field('language').value},value=>{progress.value=value;field('nano-status').textContent=`Downloading Gemini Nano: ${value}%`;},download.signal);
    field('nano-status').textContent='Gemini Nano is ready. Save settings and select text on an enabled website.';
  }catch(e){field('nano-status').textContent=download.signal.aborted?'Setup cancelled. Chrome may retain downloaded model data.':(e as Error).message;}
  finally{download=null;field('setup-nano').disabled=false;field('cancel-nano').hidden=true;progress.hidden=true;}
});
field('cancel-nano').addEventListener('click',()=>download?.abort());

for(const model of webModels){const option=document.createElement('option');option.value=model.id;option.textContent=model.name;field('web-model').append(option);}
function webModelUI(){const model=webModel(field('web-model').value);field('web-languages').textContent=model.languages;field('web-requirements').textContent=`Download estimate: ${model.download}. ${model.memory}`;(document.getElementById('web-model-source') as HTMLAnchorElement).href=model.source;}
let webOperation:AbortController|null=null;
field('web-model').addEventListener('change',()=>{webModelUI();field('web-status').textContent='Click Download & use model to prepare this model, then save your settings.';});
async function webAction(action:string){
  if(webOperation)return;const controller=new AbortController();webOperation=controller;
  for(const id of ['setup-web','check-web','remove-web','web-model','provider','save'])field(id).disabled=true;
  field('cancel-web').hidden=action==='status';field('web-status').textContent=action==='setup'?'Preparing model download. Keep this tab open…':'Checking model…';
  try{await send({type:'webllmPrepare'});controller.signal.throwIfAborted();field('web-status').textContent=await webRequest(action,read(),controller.signal,text=>field('web-status').textContent=text);}
  catch(e){field('web-status').textContent=(e as Error).message;}
  finally{webOperation=null;for(const id of ['setup-web','check-web','remove-web','web-model','provider','save'])field(id).disabled=false;field('cancel-web').hidden=true;}
}
field('setup-web').addEventListener('click',()=>void webAction('setup'));
field('check-web').addEventListener('click',()=>void webAction('status'));
field('remove-web').addEventListener('click',()=>void webAction('remove'));
field('cancel-web').addEventListener('click',()=>webOperation?.abort());
window.addEventListener('pagehide',()=>webOperation?.abort());
