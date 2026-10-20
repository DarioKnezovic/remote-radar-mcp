import Link from 'next/link';
import { Callout, PageHeader } from './ui';

/** Placeholder for screens that are still being built. */
export function ComingSoon({ title, intro }: { title: string; intro: string }) {
  return (
    <div>
      <PageHeader title={title} intro={intro} />
      <Callout tone="neutral" title="This screen is coming soon">
        Until then, you can do this from Claude with the Remote Radar tools.{' '}
        <Link href="/how-it-works" className="font-medium underline underline-offset-2">
          How it works
        </Link>
      </Callout>
    </div>
  );
}
