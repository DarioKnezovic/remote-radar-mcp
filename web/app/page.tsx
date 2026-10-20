import Link from 'next/link';
import { APPLICATION_STATUSES } from 'remote-radar-mcp/domain';
import { SetupProblem } from '@/components/setup-problem';
import { Badge, Callout, Card } from '@/components/ui';
import { STATUS_LABELS } from '@/lib/labels';
import { loadRadar } from '@/lib/load';

const STEPS = [
  {
    title: 'Tell it about you',
    text: 'Where you live, your citizenship, your skills and the languages you speak.',
    href: '/profile',
    cta: 'Set up my profile',
  },
  {
    title: 'Find jobs',
    text: 'Search remote jobs from public job boards. Each one shows how well it fits you, and why.',
    href: '/jobs',
    cta: 'Find jobs',
  },
  {
    title: 'Keep track',
    text: 'Save the good ones. After you apply on the company’s site, mark it here to keep track.',
    href: '/tracker',
    cta: 'See my jobs',
  },
] as const;

export default async function HomePage() {
  const loaded = await loadRadar();
  if (!loaded.ok) return <SetupProblem error={loaded.error} />;
  const { radar } = loaded;

  const [profile, saved] = await Promise.all([
    radar.profiles.load(),
    radar.tracker.listSavedJobs(),
  ]);
  const counts = APPLICATION_STATUSES.map((status) => ({
    status,
    count: saved.filter((s) => s.status === status).length,
  })).filter((c) => c.count > 0);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Find remote jobs that fit you, and keep track of them.
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg leading-relaxed">
          Remote Radar collects remote developer jobs from public job boards, checks each one
          against your profile, and warns you about catches like “must live in Germany”. You decide,
          and you apply yourself.
        </p>
      </section>

      {!profile.ok && (
        <Callout tone="warn" title="Start by setting up your profile">
          Without it, Remote Radar can’t tell you which jobs fit you.{' '}
          <Link href="/profile" className="font-medium underline underline-offset-2">
            Set up my profile
          </Link>
        </Callout>
      )}

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.href}>
            <Card className="flex h-full flex-col">
              <span className="bg-accent-soft text-accent flex size-7 items-center justify-center rounded-full text-sm font-semibold">
                {i + 1}
              </span>
              <h2 className="mt-3 font-semibold">{step.title}</h2>
              <p className="text-muted mt-1 flex-1 text-sm leading-relaxed">{step.text}</p>
              <Link
                href={step.href}
                className="text-accent mt-4 text-sm font-medium hover:underline"
              >
                {step.cta} →
              </Link>
            </Card>
          </li>
        ))}
      </ol>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-muted text-sm">Your profile</p>
          <p className="mt-1 text-lg font-semibold">{profile.ok ? 'Ready' : 'Not set up yet'}</p>
          {profile.ok && (
            <p className="text-muted mt-1 text-sm">
              {profile.profile.location.city ? `${profile.profile.location.city}, ` : ''}
              {profile.profile.location.country} · {profile.profile.skills.strong.length} main
              skills
            </p>
          )}
        </Card>
        <Card>
          <p className="text-muted text-sm">Saved jobs</p>
          <p className="mt-1 text-lg font-semibold">{saved.length}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {counts.map(({ status, count }) => (
              <Badge key={status}>
                {STATUS_LABELS[status].label}: {count}
              </Badge>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-muted text-sm">Job sources</p>
          <p className="mt-1 text-lg font-semibold">{radar.sources.length} public sources</p>
          <Link
            href="/how-it-works"
            className="text-accent mt-1 inline-block text-sm hover:underline"
          >
            Which ones, and how it works →
          </Link>
        </Card>
      </section>
    </div>
  );
}
