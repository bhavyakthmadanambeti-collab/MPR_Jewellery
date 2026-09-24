import { useEffect } from 'react';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useSeo(title: string, description?: string, image?: string) {
  useEffect(() => {
    const full = title.includes('MPR JEWELLERY') ? title : `${title} | MPR JEWELLERY`;
    document.title = full;
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    if (image) setMeta('meta[property="og:image"]', 'property', 'og:image', image);
  }, [title, description, image]);
}
