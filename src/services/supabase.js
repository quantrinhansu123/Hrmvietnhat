import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !String(supabaseUrl).includes('YOUR_PROJECT') &&
  supabaseAnonKey !== 'YOUR_ANON_KEY'
)

if (!isSupabaseConfigured) {
  console.error(
    '[Supabase] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Kiểm tra file .env rồi chạy lại npm run dev.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)
