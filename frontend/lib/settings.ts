// settings.ts — Shared settings types and the one place preferences are applied.
//
// NOTE: this file used to also hold getSettings()/saveSettings() helpers that
// queried a Supabase `user_settings` table. Nothing imported them, and no such
// table exists in the project (the REST API returns 404 for it), so they were
// dead code pointing at a broken dependency. Settings are actually read and
// written through the `users` row — see SettingsPage and app/security.py.
//
// Everything here is a plain function rather than part of a page component, so
// the apply/cache path can be imported from anywhere without dragging a React
// component along with it.

import { supabase } from './supabase'

export type ResearchTimeframe = '1y' | '2y' | '5y' | 'all'

/** The preferences object stored on the user row. Free-form by design. */
export type UserSettings = { theme?: string; [key: string]: any }

// Preferences are cached per account so a reload paints the user's choices
// before Supabase answers, and a failed profile fetch falls back to the last
// known settings instead of the defaults.
const SETTINGS_CACHE_KEY = 'st_user_settings'

/** Applies a theme to the DOM and remembers it for the next boot. */
export function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme.toLowerCase())
  sessionStorage.setItem('st_user_theme', theme)
}

/**
 * Applies a settings object and keeps every copy of it in step.
 *
 * Three things have to happen, in this order, or a page will show stale
 * preferences: the theme goes onto the DOM, the boot-time copies go into
 * sessionStorage, and the whole object is cached for the next load.
 */
export function applyAndStoreUserSettings(settings: UserSettings, name?: string, userId?: string) {
  if (settings.theme) applyTheme(settings.theme)
  if (name !== undefined) {
    sessionStorage.setItem('st_user_name', name)
  }
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ userId: userId ?? null, settings }))
  } catch {
    // The cache is best-effort: private browsing or a full quota must never be
    // able to break a save.
  }
}

/**
 * Saves the theme on its own, for switches outside the Settings page.
 *
 * A theme written only to sessionStorage survived a reload but not a visit to
 * Settings, which re-reads the account row and paints whatever theme that row
 * holds. The docs page has its own toggle, so it writes the same key back to
 * the row: one stored preference, two switches that agree.
 */
export async function saveUserTheme(theme: 'light' | 'dark', userId?: string | null): Promise<void> {
  // The row stores 'Light' / 'Dark'. applyTheme lowercases for the DOM.
  const stored = theme === 'dark' ? 'Dark' : 'Light'
  applyTheme(stored)

  const cached = readStoredUserSettings(userId ?? undefined)
  applyAndStoreUserSettings({ ...cached, theme: stored }, undefined, userId ?? undefined)

  // A visitor who is not signed in gets the local switch and nothing else.
  if (!userId) return

  try {
    const { data } = await supabase.from('users').select('settings').eq('id', userId).maybeSingle()
    // Merge: a theme change must not drop the chart style or the editor prefs.
    const settings = { ...(data?.settings || {}), theme: stored }
    const { error } = await supabase.from('users').update({ settings }).eq('id', userId)
    if (error) throw error

    // Turso keeps a mirror the nightly runner reads; best-effort, like Settings.
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (token) {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/user/sync-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      })
    }
  } catch {
    // The switch already applied locally. Failing to reach the row must not
    // take the theme back off the page.
  }
}

/** Cached preferences for one account, or an empty object when there are none. */
export function readStoredUserSettings(userId?: string): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    if (!raw) return {}
    const cached = JSON.parse(raw)
    if (!cached || typeof cached !== 'object') return {}
    // One account's preferences must never show up for another account that
    // signs in on the same browser.
    if (userId && cached.userId && cached.userId !== userId) return {}
    return cached.settings && typeof cached.settings === 'object' ? cached.settings : {}
  } catch {
    return {}
  }
}
