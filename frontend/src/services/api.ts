const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const ACCESS_TOKEN_KEY = 'revive_access_token';

let inMemoryAccessToken: string | null = null;

export function getAccessToken() {
  if (inMemoryAccessToken) {
    return inMemoryAccessToken;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  inMemoryAccessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return inMemoryAccessToken;
}

export function setAccessToken(accessToken: string | null) {
  inMemoryAccessToken = accessToken;

  if (typeof window === 'undefined') {
    return;
  }

  if (accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

async function refreshAccessToken() {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    setAccessToken(null);
    return null;
  }

  const session = (await response.json()) as { accessToken: string };
  setAccessToken(session.accessToken);
  return session.accessToken;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();

  const request = (accessToken: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });

  let response = await request(token);

  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await request(refreshedToken);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
