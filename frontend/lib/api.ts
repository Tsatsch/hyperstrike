import { config } from './config';

export async function exchangePrivyForBackendJwt(
  getAccessToken?: () => Promise<string | null>,
  walletAddress?: string
): Promise<string | null> {
  try {
    if (!getAccessToken || !walletAddress) return null;
    const privyToken = await getAccessToken();
    if (!privyToken) return null;

    const response = await fetch(`${config.apiUrl}/api/auth/exchange_privy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${privyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallet_address: walletAddress }),
    });

    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const token: string | undefined = data?.token;
    if (typeof window !== 'undefined' && token) {
      localStorage.setItem('Hyperstrike_backend_jwt', token);
    }
    return token ?? null;
  } catch (error) {
    return null;
  }
}

export function getBackendJwt(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('Hyperstrike_backend_jwt');
}

export async function listOrders(): Promise<unknown> {
  const jwt = getBackendJwt();
  if (!jwt) throw new Error('Missing backend JWT');
  const response = await fetch(`${config.apiUrl}/api/orders`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch orders');
  return response.json();
}

export async function expireOrder(orderId: number, reason = "time ran out"): Promise<boolean> {
  const jwt = getBackendJwt();
  if (!jwt) return false;
  const params = new URLSearchParams({ orderId: String(orderId), reason });
  const response = await fetch(`http://localhost:8000/api/order/expire?${params.toString()}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return response.ok;
}

export async function setOrderState(orderId: number, state: 'open' | 'done' | 'closed' | 'deleted', termination_message?: string): Promise<boolean> {
  const jwt = getBackendJwt();
  if (!jwt) return false;
  const response = await fetch('http://localhost:8000/api/order/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ orderId, state, termination_message }),
  });
  return response.ok;
}

export async function getUserXp(): Promise<number> {
  const jwt = getBackendJwt();
  if (!jwt) throw new Error('Missing backend JWT');
  const response = await fetch(`${config.apiUrl}/api/xp`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) throw new Error('Failed to fetch XP');
  const data = await response.json();
  return Number(data?.xp || 0);
}

export interface UserMe {
  user_id: number;
  wallet: string;
  xp: number;
  referral_code?: string;
}

export async function getOrCreateUser(getAccessToken?: () => Promise<string | null>, walletAddress?: string): Promise<UserMe | null> {
  try {
    if (!getAccessToken || !walletAddress) return null;
    const token = await getAccessToken();
    if (!token) return null;
    // include referral from URL if present
    let referralParam = '';
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get('ref');
      if (ref) referralParam = `&referral=${encodeURIComponent(ref)}`;
    } catch {}
    const response = await fetch(`${config.apiUrl}/api/user?wallet=${walletAddress}${referralParam}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function getUserMe(): Promise<UserMe | null> {
  try {
    const jwt = getBackendJwt();
    if (!jwt) return null;
    const response = await fetch(`${config.apiUrl}/api/user/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function getLeaderboard(limit = 50): Promise<Array<{ user_id: number; wallet_address: string; xp: number }>> {
  const response = await fetch(`${config.apiUrl}/api/xp/leaderboard?limit=${limit}`);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data?.leaders) ? data.leaders : [];
}

export async function claimDailyXp(): Promise<{ awarded: number; nextEligibleAt?: string } | null> {
  const jwt = getBackendJwt();
  if (!jwt) return null;
  const response = await fetch(`${config.apiUrl}/api/xp/daily_claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) return null;
  return response.json();
}


