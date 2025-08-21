// Lightweight resolver for Hyperliquid Names (.hl)
// Attempts to resolve a wallet address to a .hl name using the public API

import { config } from '@/lib/config';

type HlNameResponse = unknown;

const CACHE_KEY_PREFIX = `hlname:${config.hlNamesCacheVersion || '1'}:`;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_TTL_MS = typeof config.hlNamesCacheTtlMs === 'number' ? config.hlNamesCacheTtlMs : DEFAULT_CACHE_TTL_MS;

function getCacheKey(address: string): string {
  return `${CACHE_KEY_PREFIX}${address.toLowerCase()}`;
}

function readFromCache(address: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    if (config.hlNamesDisableCache) return null;
    const raw = window.localStorage.getItem(getCacheKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { name: string; expiresAt: number };
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(getCacheKey(address));
      return null;
    }
    return parsed.name || null;
  } catch {
    return null;
  }
}

function writeToCache(address: string, name: string): void {
  try {
    if (typeof window === 'undefined') return;
    if (config.hlNamesDisableCache) return;
    const payload = JSON.stringify({ name, expiresAt: Date.now() + CACHE_TTL_MS });
    window.localStorage.setItem(getCacheKey(address), payload);
  } catch {
    // ignore
  }
}

function extractByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  return path.split('.').reduce<any>((acc, key) => (acc && typeof acc === 'object') ? (acc as any)[key] : undefined, obj);
}

function extractHlName(candidate: HlNameResponse): string | null {
  // Try common shapes; return the first string ending with .hl
  const stringsToCheck: Array<unknown> = [];
  if (candidate && typeof candidate === 'object') {
    const obj = candidate as Record<string, unknown>;
    stringsToCheck.push(obj.name, obj.hl, obj.domain, (obj as any).primaryName, (obj as any).primary_name);
    if (obj.result && typeof obj.result === 'object') {
      const result = obj.result as Record<string, unknown>;
      stringsToCheck.push(result.name, result.hl, result.domain, (result as any).primaryName, (result as any).primary_name);
    }
  }
  // If an explicit field path is configured, check it first
  if (config.hlNamesResultField) {
    const value = extractByPath(candidate, config.hlNamesResultField);
    if (typeof value === 'string' && value.toLowerCase().endsWith('.hl')) return value;
  }
  for (const val of stringsToCheck) {
    if (typeof val === 'string' && val.toLowerCase().endsWith('.hl')) return val;
  }
  return null;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function resolveHlName(address: string): Promise<string | null> {
  if (!address || address.length < 10) return null;

  const cached = readFromCache(address);
  if (cached) return cached;

  // Try a small set of plausible endpoints in case docs change; stop on first success
  const base = config.hlNamesApiBase?.replace(/\/$/, '') || 'https://api.hlnames.xyz';
  const configured = config.hlNamesEndpoints && config.hlNamesEndpoints.length > 0 ? config.hlNamesEndpoints : [];
  const defaults: Array<string> = [
    `${base}/resolve/primary_name/{address}`,
  ];
  // If user configured endpoints, use only those; otherwise use defaults
  const templates = configured.length > 0 ? configured : defaults;
  const endpoints: Array<string> = templates.map(t => t.replace('{address}', encodeURIComponent(address)));

  for (const url of endpoints) {
    try {
      const headers: HeadersInit = {};
      if (config.hlNamesApiKey) {
        headers['Authorization'] = `Bearer ${config.hlNamesApiKey}`;
        headers['x-api-key'] = config.hlNamesApiKey;
      }
      const res = await fetchWithTimeout(url, { method: 'GET', headers });
      if (!res.ok) continue;
      const data = (await res.json()) as HlNameResponse;
      const name = extractHlName(data);
      if (name) {
        writeToCache(address, name);
        return name;
      }
      if (config.isDevelopment) {
        // eslint-disable-next-line no-console
        console.debug('[hlnames] no name in response for', url, data);
      }
    } catch (err) {
      // Network error or CORS; try next endpoint
      if (config.isDevelopment) {
        // eslint-disable-next-line no-console
        console.debug('[hlnames] request failed for', url, err);
      }
      continue;
    }
  }

  return null;
}

export type HlProfile = {
  name: string;
  namehash: string | null;
  texts: Record<string, string>;
  avatarUrl: string | null;
};

function readProfileFromCache(address: string): HlProfile | null {
  try {
    if (typeof window === 'undefined') return null;
    if (config.hlNamesDisableCache) return null;
    const raw = window.localStorage.getItem(getCacheKey(address) + ':profile');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile: HlProfile; expiresAt: number };
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(getCacheKey(address) + ':profile');
      return null;
    }
    return parsed.profile || null;
  } catch {
    return null;
  }
}

function writeProfileToCache(address: string, profile: HlProfile): void {
  try {
    if (typeof window === 'undefined') return;
    if (config.hlNamesDisableCache) return;
    const payload = JSON.stringify({ profile, expiresAt: Date.now() + CACHE_TTL_MS });
    window.localStorage.setItem(getCacheKey(address) + ':profile', payload);
  } catch {}
}

export async function resolveHlProfile(address: string): Promise<HlProfile> {
  const empty: HlProfile = { name: '', namehash: null, texts: {}, avatarUrl: null };
  if (!address || address.length < 10) return empty;
  const cached = readProfileFromCache(address);
  if (cached) return cached;

  const base = config.hlNamesApiBase?.replace(/\/$/, '') || 'https://api.hlnames.xyz';
  const headers: HeadersInit = {};
  if (config.hlNamesApiKey) {
    headers['Authorization'] = `Bearer ${config.hlNamesApiKey}`;
    headers['x-api-key'] = config.hlNamesApiKey;
  }

  // 1) Fetch names_owner to get name and namehash
  let name = '';
  let namehash: string | null = null;
  try {
    const res = await fetchWithTimeout(`${base}/utils/names_owner/${encodeURIComponent(address)}`, { headers });
    if (res.ok) {
      const arr = (await res.json()) as Array<{ name?: string; namehash?: string }>;
      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0] || {} as any;
        if (typeof first.name === 'string') name = first.name;
        if (typeof first.namehash === 'string') namehash = first.namehash;
      }
    }
  } catch (err) {
    if (config.isDevelopment) console.debug('[hlnames] names_owner failed', err);
  }

  // Fallback to resolve primary name if name missing
  if (!name) {
    try {
      const res = await fetchWithTimeout(`${base}/resolve/primary_name/${encodeURIComponent(address)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const n = (data && (data.primaryName || data.primary_name)) as string | undefined;
        if (typeof n === 'string') name = n;
      }
    } catch (err) {
      if (config.isDevelopment) console.debug('[hlnames] primary_name fallback failed', err);
    }
  }

  // 2) Fetch records via namehash if available
  let texts: Record<string, string> = {};
  if (namehash) {
    try {
      const res = await fetchWithTimeout(`${base}/records/data_record/${encodeURIComponent(namehash)}`, { headers });
      if (res.ok) {
        const rec = await res.json();
        if (rec && typeof rec === 'object') {
          // Copy only string values
          for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
            if (typeof v === 'string') texts[k] = v;
          }
        }
      }
    } catch (err) {
      if (config.isDevelopment) console.debug('[hlnames] data_record failed', err);
    }
  }

  // Determine avatar URL: first key containing 'avatar' with https value
  let avatarUrl: string | null = null;
  for (const [k, v] of Object.entries(texts)) {
    if (k.toLowerCase().includes('avatar') && typeof v === 'string' && v.startsWith('https://')) {
      avatarUrl = v;
      break;
    }
  }

  const profile: HlProfile = { name, namehash, texts, avatarUrl };
  writeProfileToCache(address, profile);
  return profile;
}


