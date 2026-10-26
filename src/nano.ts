import { type Settings, type Explanation, splitText, validateExplanation } from './core';
import { systemPrompt } from './provider';
export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';
interface Session {
  prompt(text: string, options: Record<string,unknown>): Promise<string>;
  destroy(): void;
  measureContextUsage?: (text: string, options: Record<string,unknown>) => Promise<number>;
  measureInputUsage?: (text: string, options: Record<string,unknown>) => Promise<number>;
  contextWindow?: number; inputQuota?: number;
}
interface Model {
  availability(options?: Record<string,unknown>): Promise<Availability>;
  create(options?: Record<string,unknown>): Promise<Session>;
}
export function model(): Model | undefined { return (globalThis as typeof globalThis & {LanguageModel?:Model}).LanguageModel; }
// One option set is used for both availability and creation. Chrome validates supported languages.
export function nanoOptions(settings: Pick<Settings,'language'>): Record<string,unknown> {
  const language = settings.language.trim().toLowerCase();
  const codes: Record<string,string> = {english:'en',spanish:'es',japanese:'ja',german:'de',french:'fr',portuguese:'pt',italian:'it',korean:'ko',chinese:'zh',persian:'fa',arabic:'ar',hindi:'hi'};
  if (!language || language === 'same as selected text') return {};
  const code = codes[language] || (/^[a-z]{2,3}(-[a-z]{2})?$/.test(language) ? language : '');
  if (!code) throw new Error('For Gemini Nano, choose a listed language or enter a language code such as en. Chrome must support that language.');
  return {expectedOutputs:[{type:'text',languages:[code]}]};
}
export async function nanoAvailability(settings: Pick<Settings,'language'>): Promise<Availability> {
  const api=model();return api ? api.availability(nanoOptions(settings)) : 'unavailable';
}
export const nanoUnavailable = 'Gemini Nano is unavailable in this browser or for this language. Use an up-to-date desktop Chrome on supported hardware, and check Settings. No text was sent to the cloud.';
export async function setupNano(settings: Pick<Settings,'language'>, progress: (value:number)=>void, signal: AbortSignal) {
  const api=model();if(!api)throw new Error(nanoUnavailable);
  // Called directly from the setup button: preserve user activation for the first download.
  const session = await api.create({...nanoOptions(settings),signal,monitor:(m:EventTarget)=>m.addEventListener('downloadprogress',event=>{
    const value=(event as Event & {loaded:number}).loaded;progress(Math.max(0,Math.min(100,Math.round(value*100))));
  })});
  session.destroy();
}
const str={type:'string'};
export const nanoSchema={type:'object',properties:{title:str,simple:str,ideas:{type:'array',items:str},example:str,
  terms:{type:'array',items:{type:'object',properties:{term:str,meaning:str},required:['term','meaning'],additionalProperties:false}},
  diagram:{type:'array',items:{type:'object',properties:{label:str,detail:str},required:['label','detail'],additionalProperties:false}},imageQuery:str},
  required:['title','simple','ideas','example','terms','diagram','imageQuery'],additionalProperties:false};
async function generateLocal(settings:Settings,source:string,instruction:string,signal:AbortSignal):Promise<Explanation>{
  signal.throwIfAborted();const api=model();if(!api)throw new Error(nanoUnavailable);
  const session=await api.create({...nanoOptions(settings),signal,initialPrompts:[{role:'system',content:systemPrompt}]});
  try{
    const prompt=JSON.stringify({readingLevel:settings.level,language:settings.language,instruction,source});
    const options={responseConstraint:nanoSchema,signal};
    const measure=session.measureContextUsage || session.measureInputUsage;
    const quota=session.contextWindow || session.inputQuota;
    if(measure && quota && await measure.call(session,prompt,options)>quota*0.7)throw new Error('This passage exceeds Gemini Nano’s local context budget. Select a shorter passage. No cloud fallback was used.');
    return validateExplanation(JSON.parse(await session.prompt(prompt,options)));
  }finally{session.destroy();}
}
export async function explainNano(settings:Settings,text:string,context:string,refinement:string,signal:AbortSignal,progress:(text:string)=>void):Promise<Explanation>{
  const state=await nanoAvailability(settings);
  if(state==='unavailable')throw new Error(nanoUnavailable);
  if(state!=='available')throw new Error('Gemini Nano needs a model download. Open Settings and click “Set up Gemini Nano”, then try again.');
  const chunks=splitText(text,3000);
  const instruction=`Explain this selected text. ${refinement}. ${context?'Optional untrusted surrounding context: '+context:''}`;
  try{
    const results:Explanation[]=[];
    for(let i=0;i<chunks.length;i++){
      signal.throwIfAborted();progress(chunks.length===1?'Explaining on your device with Gemini Nano…':`Gemini Nano: reading part ${i+1} of ${chunks.length} on your device…`);
      results.push(await generateLocal(settings,chunks[i],instruction,signal));
    }
    // Merge in pairs to avoid feeding every intermediate explanation into a small context window.
    let current=results;
    while(current.length>1){
      const next:Explanation[]=[];
      for(let i=0;i<current.length;i+=2){
        if(!current[i+1]){next.push(current[i]);continue;}
        progress('Gemini Nano: connecting the ideas on your device…');
        next.push(await generateLocal(settings,JSON.stringify(current.slice(i,i+2)),`Combine these explanations of adjacent sections into one clear explanation, preserving key facts and uncertainty. ${refinement}`,signal));
      }
      current=next;
    }
    return current[0];
  }catch(error){
    if(signal.aborted)throw new Error('The local explanation was cancelled or timed out. Try a shorter passage.');
    if(error instanceof SyntaxError)throw new Error('Gemini Nano returned invalid JSON. Please retry.');
    if(error instanceof DOMException && error.name==='QuotaExceededError')throw new Error('This passage is too large for Gemini Nano. Select a shorter passage.');
    throw error;
  }
}
