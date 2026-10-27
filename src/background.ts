import { defaults, cleanSettings, MAX_TEXT, safeHttps, type Settings, type Picture } from './core';
import {runWebLLM} from './webllm-bridge';
import { runNano, ensureDocument } from './nano-bridge';
import { explain, generate, demoExplanation } from './provider';

const ready = Promise.all([
  chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),
  chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
]);
async function settings(): Promise<Settings> { await ready; return cleanSettings((await chrome.storage.local.get('settings')).settings || defaults); }
async function key(): Promise<string> { await ready; const value = (await chrome.storage.session.get('apiKey')).apiKey || (await chrome.storage.local.get('apiKey')).apiKey; return typeof value === 'string' ? value : ''; }
function trusted(sender: chrome.runtime.MessageSender) { return sender.id === chrome.runtime.id && [chrome.runtime.getURL('options.html'),chrome.runtime.getURL('popup.html')].includes(sender.url || ''); }
function pageSender(sender: chrome.runtime.MessageSender) { return sender.id === chrome.runtime.id && !!sender.tab && /^https?:\/\//.test(sender.url || ''); }
async function broadcast() {
  for (const tab of await chrome.tabs.query({})) if (tab.id) chrome.tabs.sendMessage(tab.id,{type:'settingsChanged'}).catch(()=>{});
}
chrome.permissions.onRemoved.addListener(()=>{ void broadcast(); });
chrome.runtime.onInstalled.addListener(async () => {
  await ready;
  if (!(await chrome.storage.local.get('settings')).settings) await chrome.storage.local.set({settings:defaults});
});
async function activate(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId,{type:'explainSelection'});
    return {ok:true};
  } catch { return {ok:false,error:'Reload this webpage once after installing or updating Explainer, then select text again. Chrome internal pages and other protected pages are not supported.'}; }
}
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'explain-selection') return;
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (tab?.id) await activate(tab.id);
});
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (message?.target) return false;
  (async () => {
    if (!message || typeof message.type !== 'string' || sender.id !== chrome.runtime.id) throw new Error('Invalid request.');
    if (message.type === 'getSettings' && (trusted(sender) || pageSender(sender))) return {ok:true,settings:await settings()};
    if (message.type === 'openOptions' && (trusted(sender) || pageSender(sender))) { await chrome.runtime.openOptionsPage(); return {ok:true}; }
    if (!trusted(sender)) throw new Error('This action is only available in extension settings.');
    switch (message.type) {
      case 'webllmPrepare': await ensureDocument(); return {ok:true};
      case 'status': return {ok:true,settings:await settings(),hasKey:!!(await key()),persistent:!!(await chrome.storage.local.get('apiKey')).apiKey};
      case 'save': {
        const next = cleanSettings(message.settings || {});
        await chrome.storage.local.set({settings:next});
        if (typeof message.apiKey === 'string' && message.apiKey.trim()) {
          const apiKey = message.apiKey.trim();
          if (apiKey.length > 256 || /\s/.test(apiKey)) throw new Error('Check the API key format.');
          await chrome.storage.local.remove('apiKey'); await chrome.storage.session.remove('apiKey');
          await (message.remember ? chrome.storage.local : chrome.storage.session).set({apiKey});
        } else {
          const current = await key();
          await chrome.storage.local.remove('apiKey'); await chrome.storage.session.remove('apiKey');
          if (current) await (message.remember ? chrome.storage.local : chrome.storage.session).set({apiKey:current});
        }
        await broadcast(); return {ok:true};
      }
      case 'removeKey': await chrome.storage.local.remove('apiKey'); await chrome.storage.session.remove('apiKey'); return {ok:true};
      case 'test': {
        const s = await settings(); const k = await key();
        if (!k) throw new Error('Save an API key first.');
        await generate(k,s,'Photosynthesis','Give a short explanation to test the connection.',new AbortController().signal);
        return {ok:true};
      }
      case 'toggle': {
        const s = await settings(); s.enabled = !s.enabled; await chrome.storage.local.set({settings:s}); await broadcast(); return {ok:true};
      }
      case 'toggleSite': {
        const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
        if (!tab?.url || !/^https?:/.test(tab.url)) throw new Error('Open a normal webpage first.');
        const host = new URL(tab.url).hostname; const s = await settings();
        s.disabledSites = s.disabledSites.includes(host) ? s.disabledSites.filter(x=>x!==host) : [...s.disabledSites,host];
        await chrome.storage.local.set({settings:s}); await broadcast(); return {ok:true};
      }
      case 'activate': {
        const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
        return tab?.id ? activate(tab.id) : {ok:false,error:'Open a webpage first.'};
      }
      default: throw new Error('Unknown action.');
    }
  })().then(reply,error=>reply({ok:false,error:error instanceof Error ? error.message : 'Something went wrong.'}));
  return true;
});

// Strip Commons metadata HTML as text; never pass it to an HTML renderer.
function plain(value: unknown) { return String(value || '').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&[^;]+;/g,' ').slice(0,250); }
async function pictures(query: string, signal: AbortSignal): Promise<Picture[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:query+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'4',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'600',origin:'*'}).toString();
  const response = await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),credentials:'omit'});
  if (!response.ok) throw new Error('Image search is unavailable.');
  const data = await response.json();
  return Object.values(data.query?.pages || {}).flatMap((p: any) => {
    const i = p.imageinfo?.[0]; const m = i?.extmetadata || {};
    const url = safeHttps(i?.thumburl || i?.url,['upload.wikimedia.org']);
    const page = safeHttps(i?.descriptionurl,['commons.wikimedia.org']);
    const license = plain(m.LicenseShortName?.value);
    if (!url || !page || !license) return [];
    return [{url,page,title:plain(p.title).replace(/^File:/,''),artist:plain(m.Artist?.value),license,licenseUrl:safeHttps(m.LicenseUrl?.value,['creativecommons.org','www.gnu.org','commons.wikimedia.org'])}];
  }).slice(0,2);
}
chrome.runtime.onConnect.addListener(port => {
  if (['nano-inference','webllm-inference'].includes(port.name)) return;
  if (port.name !== 'explain' || !port.sender || !pageSender(port.sender)) { port.disconnect(); return; }
  const controller = new AbortController(); let started = false;
  const post = (value: unknown) => { if (!controller.signal.aborted) { try { port.postMessage(value); } catch { controller.abort(); } } };
  port.onDisconnect.addListener(()=>controller.abort());
  port.onMessage.addListener(async message => {
    if (message?.type === 'cancel') { controller.abort(); return; }
    if (started) return; started = true;
    try {
      const s = await settings();
      if (!s.enabled || s.disabledSites.includes(new URL(port.sender!.url!).hostname)) throw new Error('Explainer is disabled for this site. Enable it from the toolbar.');
      const text = typeof message?.text === 'string' ? message.text.trim() : '';
      if (!text) throw new Error('Select some text first.');
      if (text.length > MAX_TEXT) throw new Error(`Select up to ${MAX_TEXT.toLocaleString()} characters at a time. Nothing was sent.`);
      if (!s.demo && s.provider === 'cloud' && !s.consent) { post({type:'setup',message:'Choose how your selected text is shared in Settings before using AI explanations.'}); return; }
      const k = s.demo || s.provider !== 'cloud' ? '' : await key();
      if (!s.demo && s.provider === 'cloud' && !k) { post({type:'setup',message:'Add your Gemini API key in Settings, or try the offline demo.'}); return; }
      const refinement = ({simpler:'Use easier words and shorter sentences.',detail:'Give a more detailed explanation.',example:'Focus on a concrete illustrative example.'} as Record<string,string>)[message.refinement] || '';
      const engine = s.provider === 'nano' ? runNano : s.provider === 'webllm' ? runWebLLM : (settings:Settings,text:string,context:string,refinement:string,signal:AbortSignal,progress:(text:string)=>void) => explain(k,settings,text,context,refinement,signal,progress);
      const result = s.demo ? demoExplanation() : await engine(s,text,s.context && typeof message.context === 'string' ? message.context.slice(0,1800) : '',refinement,controller.signal,t=>post({type:'progress',message:t}));
      post({type:'result',explanation:result,demo:s.demo,provider:s.provider});
      if (s.images && !s.demo && result.imageQuery) {
        post({type:'imagesLoading'});
        try { post({type:'images',pictures:await pictures(result.imageQuery,controller.signal)}); }
        catch { post({type:'images',pictures:[],message:'Pictures could not load. Your explanation is ready.'}); }
      }
      post({type:'done'});
    } catch (error) { post({type:'error',message:error instanceof Error ? error.message : 'Could not explain this text. Please retry.'}); }
  });
});
