export type Settings = {
  provider: 'nano' | 'cloud';
  enabled: boolean; consent: boolean; mode: 'auto' | 'click'; demo: boolean;
  images: boolean; context: boolean; level: 'everyday' | 'beginner' | 'advanced';
  language: string; theme: 'system' | 'light' | 'dark'; model: string; disabledSites: string[];
};
export const defaults: Settings = {
  provider: 'nano', enabled: true, consent: false, mode: 'auto', demo: false, images: false, context: false,
  level: 'everyday', language: 'Same as selected text', theme: 'system',
  model: 'gemini-2.5-flash-lite', disabledSites: []
};
export const MAX_TEXT = 24000;
export const CHUNK_SIZE = 6000;
export type Explanation = {
  title: string; simple: string; ideas: string[]; example: string;
  terms: { term: string; meaning: string }[];
  diagram: { label: string; detail: string }[]; imageQuery: string;
};
export type Picture = { url: string; page: string; title: string; artist: string; license: string; licenseUrl: string };
export function splitText(text: string, limit = CHUNK_SIZE): string[] {
  const chunks: string[] = []; let rest = text.trim();
  if (!rest) throw new Error('Select some text first.');
  if (rest.length > MAX_TEXT) throw new Error(`This selection has ${rest.length.toLocaleString()} characters. Select up to ${MAX_TEXT.toLocaleString()} at a time. Nothing has been sent.`);
  while (rest.length > limit) {
    let at = rest.lastIndexOf('\n', limit);
    if (at < limit / 2) at = rest.lastIndexOf(' ', limit);
    if (at < limit / 2) at = limit;
    // Keep a surrogate pair together when splitting languages without whitespace.
    if (at === limit && /[\uD800-\uDBFF]/.test(rest[at - 1])) at--;
    chunks.push(rest.slice(0, at)); rest = rest.slice(at).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
function string(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('The AI returned an invalid explanation. Please retry.');
  return value.trim();
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('The AI returned an invalid explanation. Please retry.');
  return value;
}
export function validateExplanation(value: unknown): Explanation {
  if (!value || typeof value !== 'object') throw new Error('The AI returned no explanation. Please retry.');
  const v = value as Record<string, unknown>;
  const result = {
    title: string(v.title, 160), simple: string(v.simple, 12000),
    ideas: array(v.ideas, 12).map(x => string(x, 2000)), example: string(v.example, 4000),
    terms: array(v.terms, 12).map(x => { const t = x as Record<string, unknown>; return {term: string(t?.term, 160), meaning: string(t?.meaning, 1500)}; }),
    diagram: array(v.diagram, 6).map(x => { const d = x as Record<string, unknown>; return {label: string(d?.label, 100), detail: string(d?.detail, 400)}; }),
    imageQuery: string(v.imageQuery, 100)
  };
  if (!result.simple || !result.title) throw new Error('The AI returned an empty explanation. Please retry.');
  return result;
}
export function cleanSettings(raw: Partial<Settings>): Settings {
  return {
    provider: raw.provider === 'cloud' ? 'cloud' : 'nano',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    consent: raw.consent === true, demo: raw.demo === true, images: raw.images === true, context: raw.context === true,
    mode: raw.mode === 'click' ? 'click' : 'auto',
    level: ['beginner','advanced'].includes(raw.level || '') ? raw.level! : 'everyday',
    theme: ['dark','light'].includes(raw.theme || '') ? raw.theme! : 'system',
    model: typeof raw.model === 'string' && /^gemini-[a-z0-9.-]{1,80}$/.test(raw.model) ? raw.model : defaults.model,
    language: typeof raw.language === 'string' ? raw.language.slice(0,80) : defaults.language,
    disabledSites: Array.isArray(raw.disabledSites) ? raw.disabledSites.filter(x => typeof x === 'string').slice(0,500) : []
  };
}
export function position(rect: {left: number; right?: number; bottom: number; top: number}, width: number, height: number, viewport: {width: number; height: number}) {
  const margin = 12;
  const beside = rect.right !== undefined && rect.right + 16 + width + margin <= viewport.width && rect.bottom + height + 10 > viewport.height - margin;
  return { left: Math.max(margin, Math.min(beside ? rect.right! + 16 : rect.left, viewport.width - width - margin)),
    top: Math.max(margin, Math.min(rect.bottom + 10, viewport.height - height - margin)) };
}
export function safeHttps(url: unknown, hosts: string[]): string {
  try { const u = new URL(String(url)); return u.protocol === 'https:' && !u.username && !u.password && hosts.includes(u.hostname) ? u.href : ''; } catch { return ''; }
}
