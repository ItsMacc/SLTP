// lib/api.ts — Thin authed fetch helpers for the FastAPI backend.

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface PortfolioStatus {
  id?: string | null;
  onboarded: boolean;
  name: string;
  base_currency: string;
  starting_cash: number;
  preferences: Record<string, any>;
}

export interface CompleteSetupInput {
  name: string;
  starting_cash: number;
  base_currency: string;
  preferences: Record<string, any>;
}

async function authedFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body;
    try {
      detail = JSON.parse(body).detail || body;
    } catch {
      /* keep raw text */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ---------- Status / onboarding ----------
export async function getPortfolioStatus(token: string): Promise<PortfolioStatus> {
  return authedFetch('/api/portfolio/status', token);
}

export async function completeSetup(token: string, input: CompleteSetupInput) {
  return authedFetch('/api/portfolio/complete-setup', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAllTickers(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/stock/all-tickers`);
  if (!res.ok) return [];
  return res.json();
}
