export async function exchangePrivyForBackendJwt(
  getAccessToken?: () => Promise<string | null>,
  walletAddress?: string
): Promise<string | null> {
  try {
    if (!getAccessToken || !walletAddress) return null;
    const privyToken = await getAccessToken();
    if (!privyToken) return null;

    const response = await fetch('http://localhost:8000/api/auth/exchange_privy', {
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
  const response = await fetch('http://localhost:8000/api/orders', {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch orders');
  return response.json();
}


