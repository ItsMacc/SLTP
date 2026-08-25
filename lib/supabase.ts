import { createClient } from '@supabase/supabase-js'

// 1. Grab environment variables from Vite's import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jqyqfkrzwimxuzugyuiw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 2. Validate that the anon key is present to prevent runtime silent failures
if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY in environment variables.')
}

// 3. Initialize and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)