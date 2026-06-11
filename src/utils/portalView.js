export const PORTAL_STORAGE_KEY = 'mock-ui-portal-view';

export function getPortalView() {
  try {
    return localStorage.getItem(PORTAL_STORAGE_KEY) || 'admin';
  } catch {
    return 'admin';
  }
}

export function isUserPortalView() {
  return getPortalView() === 'user';
}
