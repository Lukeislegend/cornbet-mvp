/**
 * API base path. Uses /api which is proxied to Supabase Edge Function
 * (avoids CORS preflight issues when calling from browser).
 */
export const API_BASE = "/api";
