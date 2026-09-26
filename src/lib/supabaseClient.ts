import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rciohrloxugktqwijbun.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SSVZvG_AGv59AbXJJiJveA_I_x-qyPl';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
