// Test-only Prompt API replacement. This file is never included in production builds.
(() => {
  let state='available';let prompts=0,destroyed=0;
  globalThis.LanguageModel={availability:async()=>state,create:async(options={})=>{
    options.signal?.throwIfAborted();
    options.monitor?.({addEventListener:(_name,fn)=>fn({loaded:1})});
    return {contextWindow:16000,measureContextUsage:async()=>500,prompt:async(text,config)=>{
      config.signal?.throwIfAborted();prompts++;
      return JSON.stringify({title:'Local Nano explanation',simple:'This explanation was generated through the local Prompt API test double.',ideas:['Selected text stays local.'],example:'',terms:[],diagram:[],imageQuery:''});
    },destroy(){destroyed++;}};
  }};
  if(location.pathname==='/nano-frame.html')chrome.runtime.onMessage.addListener((m,_s,reply)=>{
    if(m.target!=='nanoMock')return;
    if(m.state)state=m.state;reply({state,prompts,destroyed});
  });
})();
