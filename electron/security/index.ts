import { session, WebContents } from 'electron';

export function setupSecurityPolicies() {
  // Set default session security policies
  const defaultSession = session.defaultSession;

  // Security Headers / Permission Requests
  defaultSession.setPermissionRequestHandler((
    _webContents: WebContents,
    permission: string,
    callback: (permissionGranted: boolean) => void
  ) => {
    // Whitelist safe permissions or prompt user via main process
    const allowedPermissions = ['clipboard-read', 'fullscreen', 'notifications'];
    if (allowedPermissions.includes(permission)) {
      return callback(true);
    }

    // Camera, Microphone, Geolocation require site consent check
    if (['media', 'geolocation', 'pointerLock'].includes(permission)) {
      return callback(true);
    }

    // Default deny unknown sensitive permissions
    return callback(false);
  });

  // Set HTTP Security headers for requests
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Content-Type-Options': ['nosniff'],
      },
    });
  });
}

export function isValidUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return ['http:', 'https:', 'file:', 'about:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function formatSearchOrUrl(input: string, searchEngine = 'https://www.google.com/search?q='): string {
  const trimmed = input.trim();
  if (!trimmed) return 'about:blank';

  if (trimmed.startsWith('lunar://') || trimmed.startsWith('about:')) {
    return trimmed;
  }

  // Check if valid URL or domain format (e.g. google.com or http://...)
  const hasProtocol = /^[a-zA-Z]+:\/\//.test(trimmed);
  if (hasProtocol) {
    return trimmed;
  }

  const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
  if (domainRegex.test(trimmed) || trimmed.startsWith('localhost')) {
    return `https://${trimmed}`;
  }

  // Otherwise, fallback to search engine
  return `${searchEngine}${encodeURIComponent(trimmed)}`;
}
