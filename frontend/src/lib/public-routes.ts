export function isPublicAppRoute(pathname: string) {
  return pathname === '/login'
    || pathname === '/qr'
    || pathname.startsWith('/qr/')
    || pathname === '/consent'
    || pathname.startsWith('/consent/');
}
