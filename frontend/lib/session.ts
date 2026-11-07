// session.ts — the one way pages read the signed-in user's access token.
//
// Three pages each had their own copy of these two lines. One helper means
// the "session expired" message can never drift between pages again.
import { supabase } from './supabase';

/** The current access token. Throws when the session is gone. */
export async function getSessionToken(): Promise<string> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  return token;
}

/** The signed-in user's id, or null without a session. Never throws. */
export async function getSessionUserId(): Promise<string | null> {
  try {
    return (await supabase.auth.getSession()).data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}
