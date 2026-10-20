import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Find jobs' };

export default function FindJobsPage() {
  return (
    <ComingSoon
      title="Find jobs"
      intro="Search remote jobs from public job boards and see how well each one fits you."
    />
  );
}
