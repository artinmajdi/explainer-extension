import { defaults, MAX_TEXT, position, safeHttps, validateExplanation, type Explanation, type Settings, type Picture } from './core';

(() => {
  const guard = '__explainerInstalled';
  if ((globalThis as any)[guard]) return;
  (globalThis as any)[guard] = true;
  let settings: Settings = {...defaults};
  let host: HTMLDivElement | null = null, shadow: ShadowRoot, panel: HTMLElement, body: HTMLElement;
  let port: chrome.runtime.Port | null = null;
  let generation = 0, timer: ReturnType<typeof setTimeout>, pinned = false, open = false;
  let selected = '', context = '', previous = '', rect = {left:24,right:24,top:100,bottom:110};
  let current: Explanation | null = null;
  let restoreFocus: HTMLElement | null = null;
  let media = matchMedia('(prefers-color-scheme: dark)');
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => {
    const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node;
  };
  function button(label: string, action: () => void, cls = '') {
    const b = el('button',label,cls); b.type = 'button'; b.addEventListener('click',action); return b;
  }
  function cancel() { generation++; if (port) { port.disconnect(); port = null; } }
  function close() { cancel(); host?.remove(); host = null; open = false; pinned = false; current = null; if (restoreFocus?.isConnected) restoreFocus.focus({preventScroll:true}); restoreFocus = null; }
  function applyTheme() { if (host) host.dataset.theme = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme; }
  media.addEventListener('change',applyTheme);
  async function refresh() {
    try { const response = await chrome.runtime.sendMessage({type:'getSettings'}); if (response.ok) settings = response.settings; applyTheme(); if (!allowed()) close(); } catch { close(); }
  }
  function allowed() { return settings.enabled && !settings.disabledSites.includes(location.hostname); }
  function place() {
    if (!host || !panel) return;
    const box = panel.getBoundingClientRect();
    const pos = position(rect,box.width,box.height,{width:innerWidth,height:innerHeight});
    host.style.setProperty('left',pos.left+'px','important'); host.style.setProperty('top',pos.top+'px','important');
  }
  function mount(chip = false) {
    host?.remove(); host = el('div'); host.id = 'explainer-root';
    host.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;display:block!important;margin:0!important;padding:0!important;border:0!important;width:auto!important;height:auto!important;';
    shadow = host.attachShadow({mode:'open'});
    const style = el('style'); style.textContent = styles; shadow.append(style);
    panel = el('section','',chip?'chip':'panel'); panel.setAttribute('aria-label','Explainer'); panel.setAttribute('role',chip?'region':'dialog');
    panel.addEventListener('pointerdown',event=>{event.stopPropagation();});
    shadow.append(panel); document.documentElement.append(host); applyTheme();
    if (chip) { panel.append(button('✦  Explain',()=>request(), 'launch')); place(); return; }
    const header = el('header'); const brand = el('div','','brand'); brand.append(el('span','✦','logo'),el('span','Explainer'));
    const controls = el('div','','controls');
    const pin = button('Pin',()=>{pinned=!pinned;pin.textContent=pinned?'Unpin':'Pin';pin.setAttribute('aria-pressed',String(pinned));}); pin.setAttribute('aria-pressed','false');
    controls.append(pin,button('Settings',()=>void chrome.runtime.sendMessage({type:'openOptions'})),button('×',close,'close'));
    controls.lastElementChild!.setAttribute('aria-label','Close explanation'); header.append(brand,controls);
    body = el('div','','body');
    const footer = el('footer','AI explanations can make mistakes. Check important details.');
    panel.append(header,body,footer);
    new ResizeObserver(place).observe(panel); place();
  }
  function status(text: string, kind: 'loading' | 'error' | 'setup' = 'loading') {
    body.replaceChildren();
    const tag = el('div',kind==='loading'?'MAKING SENSE OF IT':kind==='setup'?'LET’S GET STARTED':'LET’S TRY THAT AGAIN','eyebrow');
    const message = el('p',text,'status'); message.setAttribute('role',kind==='error'?'alert':'status');
    body.append(tag,message);
    if (kind==='loading') { const skeleton=el('div','','skeleton'); skeleton.append(el('i'),el('i'),el('i'));body.append(skeleton); }
    if (kind==='setup') body.append(button('Open settings →',()=>void chrome.runtime.sendMessage({type:'openOptions'}),'primary'));
    if (kind==='error') body.append(button('Retry',()=>request(),'primary'),button('Settings',()=>void chrome.runtime.sendMessage({type:'openOptions'}),'secondary'));
    place();
  }
  function section(title: string) { const s = el('section','','section');s.append(el('h3',title));return s; }
  function render(explanation: Explanation, demo: boolean, provider?: string) {
    current = explanation; body.replaceChildren();
    if (demo) body.append(el('div','OFFLINE DEMO · Sample about photosynthesis, not your selected text.','demo'));
    body.append(el('div',provider==='nano'?'GEMINI NANO · ON YOUR DEVICE':'A LITTLE CLARITY','eyebrow'),el('h2',explanation.title));
    const quote = el('div',selected.length>180?selected.slice(0,180)+'…':selected,'quote'); quote.title='Your selected text'; body.append(quote);
    const simple=section('In simple terms'); simple.append(el('p',explanation.simple));body.append(simple);
    if (explanation.ideas.length) { const s=section('Key ideas');const list=el('ul');explanation.ideas.forEach(x=>list.append(el('li',x)));s.append(list);body.append(s); }
    if (explanation.example) { const s=section('Think of it this way');s.classList.add('analogy');s.append(el('p',explanation.example));body.append(s); }
    if (explanation.diagram.length) {
      const s=section('See how it works');const flow=el('ol','','flow');
      explanation.diagram.forEach((x,i)=>{const item=el('li');item.append(el('span',String(i+1),'step'),el('strong',x.label),el('span',x.detail,'detail'));flow.append(item);});s.append(flow);body.append(s);
    }
    if (explanation.terms.length) { const s=section('Words, unpacked');const list=el('dl');explanation.terms.forEach(t=>list.append(el('dt',t.term),el('dd',t.meaning)));s.append(list);body.append(s); }
    const images=el('div');images.id='pictures';body.append(images);
    const actions=el('div','','actions');
    actions.append(button('Simpler',()=>request('simpler')),button('More detail',()=>request('detail')),button('Show example',()=>request('example')));
    const copy=button('Copy',async()=>{
      try { await navigator.clipboard.writeText([demo?'OFFLINE DEMO — sample, not an explanation of selected text':'',explanation.title,explanation.simple,...explanation.ideas,explanation.example,...explanation.terms.map(t=>`${t.term}: ${t.meaning}`)].filter(Boolean).join('\n\n'));copy.textContent='Copied'; }
      catch { copy.textContent='Could not copy'; }
    }); actions.append(copy);body.append(actions);place();
  }
  function renderPictures(pictures: Picture[], message?: string) {
    const target=shadow.getElementById('pictures'); if (!target) return; target.replaceChildren();
    if (!pictures.length) { target.append(el('p',message || 'No suitable picture found.','muted'));return; }
    target.append(el('h3','A closer look'));
    pictures.forEach(p=>{
      const url=safeHttps(p.url,['upload.wikimedia.org']),page=safeHttps(p.page,['commons.wikimedia.org']);if (!url || !page) return;
      const figure=el('figure');const img=el('img');img.src=url;img.alt=p.title;img.referrerPolicy='no-referrer';img.loading='lazy';
      img.addEventListener('error',()=>{img.remove();figure.prepend(el('p','This picture could not load.','muted'));});
      const caption=el('figcaption');const link=el('a',p.title);link.href=page;link.target='_blank';link.rel='noopener noreferrer';
      caption.append(link,el('span',[p.artist,p.license].filter(Boolean).join(' · ')));
      const licenseUrl=safeHttps(p.licenseUrl,['creativecommons.org','www.gnu.org','commons.wikimedia.org']);
      if (licenseUrl) {const license=el('a','License');license.href=licenseUrl;license.target='_blank';license.rel='noopener noreferrer';caption.append(license);}
      figure.append(img,caption);target.append(figure);
    });place();
  }
  function request(refinement = '') {
    if (!selected || !allowed()) return;
    cancel();const id=generation;open=true;
    if (!host || !panel.classList.contains('panel')) mount();
    if (selected.length>MAX_TEXT) {status(`This selection has ${selected.length.toLocaleString()} characters. Select up to ${MAX_TEXT.toLocaleString()} at a time. Nothing was sent.`,'error');return;}
    status('Finding a simpler way to explain this…');
    let finished=false;
    try {
      const connection=chrome.runtime.connect({name:'explain'});port=connection;
      connection.onMessage.addListener(message=>{
        if (id!==generation || !host) return;
        if (message.type==='progress') {const label=body.querySelector('.status');if(label)label.textContent=message.message;}
        if (message.type==='setup' || message.type==='error') {finished=true;status(message.message,message.type);connection.disconnect();}
        if (message.type==='result') {
          try { render(validateExplanation(message.explanation),message.demo===true,message.provider); }
          catch {finished=true;status('The explanation was invalid. Please retry.','error');connection.disconnect();}
        }
        if (message.type==='imagesLoading') shadow.getElementById('pictures')?.append(el('p','Finding a relevant picture…','muted'));
        if (message.type==='images') renderPictures(Array.isArray(message.pictures)?message.pictures:[],message.message);
        if (message.type==='done') {finished=true;connection.disconnect();}
      });
      connection.onDisconnect.addListener(()=>{
        void chrome.runtime.lastError;
        if (id===generation && !finished && host) status('The connection was interrupted. Retry to reconnect.','error');
      });
      connection.postMessage({text:selected,context,refinement});
    } catch {status('The extension was reloaded. Refresh this webpage and try again.','error');}
  }
  function capture(forced?: string) {
    const selection=window.getSelection();
    const active=document.activeElement;
    if (active?.closest('input,textarea,[contenteditable]:not([contenteditable="false"])')) return false;
    if (selection?.anchorNode && (host?.contains(selection.anchorNode) || selection.anchorNode.getRootNode()===shadow)) return false;
    if (selection?.anchorNode?.parentElement?.closest('input,textarea,[contenteditable]:not([contenteditable="false"])')) return false;
    const text=(forced || selection?.toString() || '').trim();if (!text) return false;
    selected=text;
    if (selection?.rangeCount) {const r=selection.getRangeAt(0).getBoundingClientRect();if(r.width||r.height)rect={left:r.left,right:r.right,top:r.top,bottom:r.bottom};}
    context=settings.context ? (selection?.anchorNode?.parentElement?.closest('p,li,article')?.textContent || '').slice(0,1800) : '';
    return true;
  }
  function selectionSettled() {
    if (!allowed() || pinned || shadow?.activeElement) return;
    if (!capture()) return;
    if (selected===previous && host) return;
    previous=selected;
    if(settings.mode==='click'){cancel();open=false;mount(true);}else request();
  }
  document.addEventListener('selectionchange',()=>{clearTimeout(timer);timer=setTimeout(selectionSettled,600);});
  document.addEventListener('pointerdown',event=>{
    if (host && !event.composedPath().includes(host) && !pinned) {close();previous='';}
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && host){close();previous='';}
  },true);
  window.addEventListener('resize',place,{passive:true});
  document.addEventListener('scroll',()=>{
    if(!host || pinned)return;
    const selection=window.getSelection();
    if(selection?.rangeCount && selection.toString().trim()===selected) {const r=selection.getRangeAt(0).getBoundingClientRect();rect={left:r.left,right:r.right,top:r.top,bottom:r.bottom};}
    place();
  },{passive:true,capture:true});
  chrome.runtime.onMessage.addListener(message=>{
    if(message.type==='settingsChanged')void refresh();
    if(message.type==='explainSelection')void refresh().then(()=>{if(capture(message.text)){restoreFocus=document.activeElement as HTMLElement;request();panel.querySelector('button')?.focus();}});
  });
  void refresh();
})();

const styles = `
:host{--bg:#fffefb;--fg:#252c29;--muted:#737c75;--line:#e5e9e2;--green:#2c664d;--wash:#f0f5ed;--accent:#e5efcf;color-scheme:light;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--fg);text-align:left;letter-spacing:normal}
:host([data-theme=dark]){--bg:#202723;--fg:#edf2e9;--muted:#abb8ad;--line:#3b473e;--green:#b6d997;--wash:#2b362d;--accent:#3c5030;color-scheme:dark}
*{box-sizing:border-box}button{font:inherit;cursor:pointer;color:inherit}button:focus-visible,a:focus-visible{outline:3px solid #99ba58;outline-offset:3px}button{border:1px solid var(--line);border-radius:9px;background:var(--bg);padding:6px 10px;transition:background .15s}button:hover{background:var(--wash)}.panel,.chip{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;letter-spacing:normal}.panel{width:min(430px,calc(100vw - 24px));max-height:min(680px,calc(100vh - 24px));display:flex;flex-direction:column;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:18px;box-shadow:0 16px 60px #17281c26,0 2px 8px #17281c12;overflow:hidden}.chip{background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 5px 24px #17281c26}.launch{border:0;color:var(--green);font-weight:650;padding:9px 16px}header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;border-bottom:1px solid var(--line);flex-shrink:0}.brand{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:-.3px}.logo{color:var(--green);background:var(--accent);width:28px;height:28px;display:grid;place-items:center;border-radius:8px;font-size:20px}.controls{display:flex;align-items:center;gap:4px}.controls button{font-size:11px;border:0;padding:5px 7px;color:var(--muted)}.controls .close{font-size:22px;padding:0 7px}.controls button[aria-pressed=true]{background:var(--accent);color:var(--green)}.body{padding:22px;overflow:auto;overscroll-behavior:contain;min-height:0}.eyebrow{font-size:10px;font-weight:750;letter-spacing:1.7px;color:var(--green);margin:0 0 10px}h2{font-size:24px;line-height:1.22;letter-spacing:-.7px;font-weight:650;margin:0 0 16px}h3{font-size:12px;font-weight:700;margin:0 0 8px;color:var(--green)}p{margin:0;white-space:pre-wrap}ul{padding-left:18px;margin:0}li{padding-left:3px;margin-bottom:8px}li:last-child{margin-bottom:0}.quote{font-size:12px;color:var(--muted);border-left:2px solid #a6bc86;padding-left:10px;margin-bottom:22px;max-height:70px;overflow:auto;white-space:pre-wrap}.section{margin-top:20px}.section:first-of-type{margin-top:0}.analogy{background:var(--wash);border:1px solid var(--line);border-radius:12px;padding:15px;font-size:13px}.flow{list-style:none;padding:0;margin:0;display:grid;gap:8px}.flow li{position:relative;display:grid;grid-template-columns:25px 1fr;column-gap:9px;background:var(--wash);border-radius:10px;padding:11px;margin:0}.step{grid-row:span 2;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--accent);font-size:11px;font-weight:700;color:var(--green)}.flow strong{font-size:12px}.detail{grid-column:2;font-size:12px;color:var(--muted)}dl{margin:0;font-size:12px}dt{font-weight:700;margin-top:9px}dd{margin:2px 0 0;color:var(--muted)}.actions{display:flex;flex-wrap:wrap;gap:7px;border-top:1px solid var(--line);padding-top:17px;margin-top:22px}.actions button{font-size:11px;color:var(--green);font-weight:600}footer{font-size:10px;text-align:center;color:var(--muted);border-top:1px solid var(--line);padding:10px 12px;flex-shrink:0}.status{margin:12px 0 20px;font-size:16px}.primary{background:var(--green);color:var(--bg);border:0;font-weight:650}.primary:hover{opacity:.9;background:var(--green)}.secondary{margin-left:8px}.skeleton{display:grid;gap:10px;padding:6px 0 14px}.skeleton i{height:10px;background:var(--wash);border-radius:5px;animation:pulse 1.4s infinite}.skeleton i:last-child{width:60%}@keyframes pulse{50%{opacity:.4}}.demo{font-size:11px;background:var(--accent);color:var(--fg);padding:10px 12px;border-radius:10px;margin-bottom:18px}.muted{font-size:11px;color:var(--muted);margin:12px 0}figure{margin:12px 0 0;border:1px solid var(--line);border-radius:12px;overflow:hidden}img{display:block;width:100%;max-height:200px;object-fit:contain;background:var(--wash)}figcaption{font-size:10px;padding:10px;display:grid;gap:4px;color:var(--muted)}a{color:var(--green);overflow-wrap:anywhere}#pictures:empty{display:none}#pictures:not(:empty){margin-top:20px}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
