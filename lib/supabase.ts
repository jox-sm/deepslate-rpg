import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("--- Supabase Connection Check ---");
console.log("URL exists:", !!supabaseUrl);
console.log("Key exists:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: Supabase environment variables are missing!");
}

export const supabase = createClient(supabaseUrl!, supabaseKey!);