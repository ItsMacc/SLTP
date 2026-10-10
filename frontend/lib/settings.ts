// settings.ts — Shared settings types.
//
// NOTE: this file used to also hold getSettings()/saveSettings() helpers that
// queried a Supabase `user_settings` table. Nothing imported them, and no such
// table exists in the project (the REST API returns 404 for it), so they were
// dead code pointing at a broken dependency. Settings are actually read and
// written through the `users` row — see SettingsPage and app/security.py.
// Only the timeframe type below is genuinely consumed.

export type PerformanceTimeframe = '1y' | '2y' | '5y' | 'all'
