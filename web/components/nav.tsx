'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/jobs', label: 'Find jobs' },
  { href: '/tracker', label: 'My jobs' },
  { href: '/profile', label: 'My profile' },
  { href: '/how-it-works', label: 'How it works' },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="-mx-1 flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              active
                ? 'bg-accent-soft text-accent font-medium'
                : 'text-muted hover:bg-surface-muted hover:text-text'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
