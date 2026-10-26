import { explainNano } from './nano';
(globalThis as any).explainNano = explainNano;

(globalThis as any).webTask = async (...args: Parameters<typeof import('./webllm').webTask>) => (await import('./webllm')).webTask(...args);
