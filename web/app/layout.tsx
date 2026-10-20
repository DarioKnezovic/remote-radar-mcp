import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Remote Radar', template: '%s · Remote Radar' },
  description: 'Find remote jobs that fit you, see why, and keep track of your applications.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col font-sans">
        <header className="bg-surface border-border border-b">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="bg-accent inline-block size-2.5 rounded-full" />
              Remote Radar
            </Link>
            <Nav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">{children}</main>
        <footer className="border-border text-muted border-t">
          <div className="mx-auto max-w-5xl px-4 py-5 text-sm">
            Remote Radar finds and compares jobs.{' '}
            <strong className="text-text font-medium">It never applies for you</strong>: you always
            apply yourself, on the company’s own page.
          </div>
        </footer>
      </body>
    </html>
  );
}
