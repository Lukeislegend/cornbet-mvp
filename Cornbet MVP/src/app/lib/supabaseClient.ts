import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// Singleton Supabase client (anon key — for auth only on the frontend)
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
