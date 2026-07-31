const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const apiAssetUrl = (path: string) => `${API_URL}${path}`;
const ACCESS_TOKEN_KEY = 'revive_access_token';
export const AUTH_UNAUTHORIZED_EVENT = 'revive:auth-unauthorized';
export const DATA_CHANGED_EVENT = 'revive:data-changed';
const REQUEST_TIMEOUT_MS = 20_000;

export type DataChangeDetail = {
  path: string;
  method: string;
};

function notifyDataChanged(path: string, method: string) {
  if (typeof window === 'undefined' || method === 'GET' || method === 'HEAD' || path.startsWith('/auth/')) return;
  window.dispatchEvent(new CustomEvent<DataChangeDetail>(DATA_CHANGED_EVENT, { detail: { path, method } }));
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly correlationId?: string,
    readonly issues?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function userSafeApiMessage(message?: string) {
  const fallback = 'Something went wrong. Please try again.';
  if (!message) return fallback;
  if (/^Route\s+\w+\s+\/api\//i.test(message)) return 'This information could not be loaded. Please try again.';
  if (/prisma|database|sql|stack|validation error count|schema/i.test(message)) return fallback;
  return message;
}

let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !init?.signal?.aborted)
      throw new ApiError('The server took too long to respond. Please try again.', 408);
    if (error instanceof ApiError) throw error;
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 503);
  } finally {
    globalThis.clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abort);
  }
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function setAccessToken(accessToken: string | null) {
  inMemoryAccessToken = accessToken;

  if (typeof window === 'undefined') {
    return;
  }

  // Access tokens intentionally remain in memory. Remove tokens persisted by older builds.
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function notifyUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
}

async function performTokenRefresh() {
  const response = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    setAccessToken(null);
    notifyUnauthorized();
    return null;
  }

  const session = (await response.json()) as { accessToken: string };
  setAccessToken(session.accessToken);
  return session.accessToken;
}

export async function restoreSession<T>() {
  const response = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    setAccessToken(null);
    return null;
  }
  const session = (await response.json()) as T & { accessToken: string };
  setAccessToken(session.accessToken);
  return session;
}

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();

  const request = (accessToken: string | null) =>
    fetchWithTimeout(`${API_URL}${path}`, {
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
    const error = (await response.json().catch(() => ({ message: 'Request failed' }))) as {
      message?: string;
      correlationId?: string;
      issues?: unknown;
    };
    throw new ApiError(
      userSafeApiMessage(error.message),
      response.status,
      error.correlationId ?? response.headers.get('x-correlation-id') ?? undefined,
      error.issues,
    );
  }

  if (response.status === 204) {
    notifyDataChanged(path, (init?.method ?? 'GET').toUpperCase());
    return undefined as T;
  }

  const data = (await response.json()) as T;
  notifyDataChanged(path, (init?.method ?? 'GET').toUpperCase());
  return data;
}

export async function apiBlob(path: string): Promise<Blob> {
  const request = (accessToken: string | null) =>
    fetchWithTimeout(`${API_URL}${path}`, {
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
  let response = await request(getAccessToken());
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await request(refreshedToken);
  }
  if (!response.ok)
    throw new ApiError(
      'File download failed',
      response.status,
      response.headers.get('x-correlation-id') ?? undefined,
    );
  return response.blob();
}
