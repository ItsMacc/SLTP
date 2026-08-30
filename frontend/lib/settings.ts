import { supabase } from './supabase'

export type RiskProfile = 'low' | 'medium' | 'High'
export type PerformanceTimeframe = '1y' | '2y' | '5y' | 'all'
export type Theme = 'light' | 'dark'

export interface UserSettings {
  user_id: string
  full_name: string
  risk_profile: RiskProfile
  default_timeframe: PerformanceTimeframe
  theme: Theme
  email_updates: boolean
  weekly_summary: boolean
}

type SettingsInput = Omit<UserSettings, 'user_id'>

export const getSettings = (userId: string) =>
  supabase
    .from('user_settings')
    .select('user_id, full_name, risk_profile, default_timeframe, theme, email_updates, weekly_summary')
    .eq('user_id', userId)
    .maybeSingle<UserSettings>()

export const saveSettings = (userId: string, settings: SettingsInput) =>
  supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' })



