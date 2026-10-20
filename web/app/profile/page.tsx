import type { Metadata } from 'next';
import { ProfileForm } from '@/components/profile-form';
import { SetupProblem } from '@/components/setup-problem';
import { Callout, PageHeader } from '@/components/ui';
import { countryChoices, LANGUAGE_SUGGESTIONS, timezoneChoices } from '@/lib/choices';
import { loadRadar } from '@/lib/load';

export const metadata: Metadata = { title: 'My profile' };

export default async function ProfilePage() {
  const loaded = await loadRadar();
  if (!loaded.ok) return <SetupProblem error={loaded.error} />;
  const result = await loaded.radar.profiles.load();
  const choices = {
    countries: countryChoices(),
    timezones: timezoneChoices(),
    languages: LANGUAGE_SUGGESTIONS,
  };

  if (result.ok) {
    return (
      <div>
        <PageHeader
          title="My profile"
          intro="Remote Radar compares every job with this. It stays on your computer and is never sent anywhere."
        />
        <ProfileForm mode="full" initial={result.profile} {...choices} />
        <p className="text-muted mt-6 text-xs">
          Saved in <code>{result.file}</code>. If you also use Remote Radar from Claude, it uses
          this same profile.
        </p>
      </div>
    );
  }

  // No profile yet, or the file can't be used: a short guided setup.
  const broken = result.issues !== undefined || !result.error.startsWith('No profile');
  return (
    <div>
      <PageHeader
        title="Set up your profile"
        intro="Three short steps. Remote Radar uses this to tell you which jobs are open to you and how well they fit. It stays on your computer."
      />
      {broken && (
        <div className="mb-6">
          <Callout tone="warn" title="Your existing profile file couldn’t be used">
            <p>Saving this form replaces it.</p>
            <details className="mt-2">
              <summary className="cursor-pointer">Details</summary>
              <p className="mt-1 text-xs break-words">{result.error}</p>
            </details>
          </Callout>
        </div>
      )}
      <ProfileForm mode="wizard" initial={undefined} {...choices} />
    </div>
  );
}
