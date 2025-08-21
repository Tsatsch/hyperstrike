// Configuration for different environments
export const config = {
  // Backend API URL - will be overridden by environment variables in production
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  // Hyperliquid Names API config (optional)
  hlNamesApiBase: process.env.NEXT_PUBLIC_HL_NAMES_API_BASE || 'https://api.hlnames.xyz',
  hlNamesApiKey: process.env.NEXT_PUBLIC_HL_NAMES_API_KEY || '',
  // Comma-separated list of endpoint templates. Use {address} placeholder.
  // Example: "https://api.hlnames.xyz/api/v1/names/reverse?address={address}"
  hlNamesEndpoints: (
    process.env.NEXT_PUBLIC_HL_NAMES_ENDPOINTS ||
    process.env.NEXT_PUBLIC_HL_NAMES_ENDPOINT ||
    process.env.NEXT_PUBLIC_HL_NAME_ENDPOINT ||
    ''
  ).split(',').map(s => s.trim()).filter(Boolean),
  // Optional explicit JSON field path (dot notation) to read the name from, e.g. "result.primary_name"
  hlNamesResultField: process.env.NEXT_PUBLIC_HL_NAMES_RESULT_FIELD || process.env.NEXT_PUBLIC_HL_NAME_RESULT_FIELD || '',
  // Cache configuration
  hlNamesCacheTtlMs: Number(process.env.NEXT_PUBLIC_HL_NAMES_CACHE_TTL_MS || '') || undefined,
  hlNamesCacheVersion: String(process.env.NEXT_PUBLIC_HL_NAMES_CACHE_VERSION || '1'),
  hlNamesDisableCache: process.env.NEXT_PUBLIC_HL_NAMES_DISABLE_CACHE === '1',
  
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
