/** Resolve a file in client/public respecting the configured Vite base. */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

/** Href for opening a site path in a new tab (works with both hash and browser routing). */
export const siteHref = (path: string) => (import.meta.env.VITE_ROUTER_MODE === 'hash' ? `#${path}` : path);
