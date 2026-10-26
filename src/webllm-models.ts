// Language claims come from the linked model authors, not inferred from model names.
const qwenLanguages = 'Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, and Arabic. The author reports 29+ languages; this is the explicitly named subset, not an exhaustive list. Persian is not explicitly verified here.';
export const webModels = [
  {id:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',name:'Qwen2.5 · 0.5B · compact / lower quality',languages:qwenLanguages,memory:'About 0.95 GB GPU memory, plus browser overhead.',download:'Several hundred MB',file:'Qwen2-0.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm',source:'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct'},
  {id:'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',name:'Qwen2.5 · 1.5B · recommended',languages:qwenLanguages,memory:'About 1.63 GB GPU memory, plus browser overhead.',download:'Around 1 GB',file:'Qwen2-1.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm',source:'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct'},
] as const;
export const defaultWebModel=webModels[1].id;
export function webModel(id:string){const model=webModels.find(m=>m.id===id);if(!model)throw new Error('Choose a supported WebLLM model in Settings.');return model;}
