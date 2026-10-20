import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'My profile' };

export default function MyProfilePage() {
  return (
    <ComingSoon
      title="My profile"
      intro="Where you live, your citizenship, skills and languages. Used to check which jobs fit you."
    />
  );
}
