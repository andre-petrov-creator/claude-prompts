import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';

export function supabaseAdmin() {
  return createClient<Database>(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
