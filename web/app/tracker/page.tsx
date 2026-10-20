import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'My jobs' };

export default function MyJobsPage() {
  return (
    <ComingSoon
      title="My jobs"
      intro="The jobs you saved, and where you are with each application."
    />
  );
}
