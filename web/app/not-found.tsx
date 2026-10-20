import Link from 'next/link';
import { PageHeader } from '@/components/ui';

export default function NotFound() {
  return (
    <div>
      <PageHeader
        title="Page not found"
        intro="This page doesn’t exist, or the job is no longer available."
      />
      <Link href="/" className="text-accent font-medium hover:underline">
        ← Back to the start
      </Link>
    </div>
  );
}
