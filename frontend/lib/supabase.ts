// supabase.ts — The browser Supabase client. The anon key is public by
// design; row-level security in Supabase is what protects the data.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jqyqfkrzwimxuzugyuiw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxeXFma3J6d2lteHV6dWd5dWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzg2OTMsImV4cCI6MjEwMjY1NDY5M30.y51b5p_W5hhba94182apC7hlJTnDrA3GoaIZw1moYd4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);