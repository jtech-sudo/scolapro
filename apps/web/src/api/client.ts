const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isLocalNetworkHost(hostname: string) {
  const host = hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(host)
    || host.startsWith('10.')
    || host.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    || /^((?:[a-z0-9-]+\.)?local)$/i.test(host);
}

function isLocalEnvApiUrl(value?: string) {
  if (!value) return false;

  try {
    const { hostname } = new URL(value);
    const host = hostname.toLowerCase();
    return isLocalNetworkHost(host);
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl({
  hostname,
  protocol,
  envUrl,
}: {
  hostname: string;
  protocol: string;
  envUrl?: string;
}) {
  const browserHost = hostname || 'localhost';
  const browserProtocol = protocol || 'http:';

  if (isLocalNetworkHost(browserHost) && isLocalEnvApiUrl(envUrl)) {
    return `${browserProtocol}//${browserHost}:3000/api/v1`;
  }

  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  return `${browserProtocol}//${browserHost}:3000/api/v1`;
}

const DEFAULT_BROWSER_HOSTNAME = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const DEFAULT_BROWSER_PROTOCOL = typeof window === 'undefined' ? 'http:' : window.location.protocol;
const VITE_API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_BASE_URL : undefined;

export const API_BASE_URL = resolveApiBaseUrl({
  hostname: DEFAULT_BROWSER_HOSTNAME,
  protocol: DEFAULT_BROWSER_PROTOCOL,
  envUrl: VITE_API_BASE_URL,
});

const AUTH_TOKEN_KEY = 'csp-saas-access-token';
const PLATFORM_TOKEN_KEY = 'csp-platform-admin-access-token';
const PARENT_TOKEN_KEY = 'csp-parent-access-token';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export function setAuthToken(token: string) {
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getAuthToken() {
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken() {
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function setPlatformToken(token: string) {
  window.sessionStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function getPlatformToken() {
  return window.sessionStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function clearPlatformToken() {
  window.sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
}

export function setParentAuthToken(token: string) {
  window.sessionStorage.setItem(PARENT_TOKEN_KEY, token);
}

export function getParentAuthToken() {
  return window.sessionStorage.getItem(PARENT_TOKEN_KEY);
}

export function clearParentAuthToken() {
  window.sessionStorage.removeItem(PARENT_TOKEN_KEY);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrls = Array.from(new Set([
    API_BASE_URL,
    resolveApiBaseUrl({
      hostname: typeof window === 'undefined' ? 'localhost' : window.location.hostname,
      protocol: typeof window === 'undefined' ? 'http:' : window.location.protocol,
      envUrl: VITE_API_BASE_URL,
    }),
  ]));

  let lastError: unknown;

  for (const baseUrl of baseUrls) {
    try {
      const isPlatformRoute = path.startsWith('/platform/');
      const isParentRoute = path.startsWith('/parent-portal/parent/');
      const token = isPlatformRoute ? getPlatformToken() : isParentRoute ? getParentAuthToken() : getAuthToken();
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload?.message === 'string'
          ? payload.message
          : Array.isArray(payload?.message) && payload.message.every((item: unknown) => typeof item === 'string')
            ? payload.message.join(' ')
            : `La requête a échoué (HTTP ${response.status}).`;
        throw new Error(message);
      }

      return payload as T;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('API inaccessible. Vérifiez que le serveur backend est démarré.');
}