import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
export default function NotFound() {
  useSeo('Page not found');
  return (
    <div className="container-lux flex flex-col items-center py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-[40px]">This page could not be found</h1>
      <p className="mt-2 text-cocoa-100">The link may be old or the page may have moved.</p>
      <Link to="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
