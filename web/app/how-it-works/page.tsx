import type { Metadata } from 'next';
import { RED_FLAG_CODES, REMOTE_SCOPES, type SourceId } from 'remote-radar-mcp/domain';
import { SetupProblem } from '@/components/setup-problem';
import { Callout, Card, PageHeader, Section } from '@/components/ui';
import { RED_FLAG_LABELS, SCOPE_LABELS, SOURCE_DESCRIPTIONS } from '@/lib/labels';
import { loadRadar } from '@/lib/load';

export const metadata: Metadata = { title: 'How it works' };

const PIPELINE = [
  {
    title: 'Collect',
    text: 'Asks each public job source for its current remote jobs. Results are kept for 1–6 hours, so the sources aren’t asked too often.',
  },
  {
    title: 'Clean up',
    text: 'Puts every job into the same format and works out where it can be done from (“From Europe”, “From the US only”…).',
  },
  {
    title: 'Remove duplicates',
    text: 'The same job often appears on several boards. It keeps one copy, preferably the company’s own listing.',
  },
  {
    title: 'Compare with you',
    text: 'Checks the job against your profile: matching skills, and catches like “must live in Germany” or “fluent German required”.',
  },
  {
    title: 'You decide',
    text: 'You read the original listing and apply yourself, on the company’s site. Then you track it here.',
  },
] as const;

const NEVER = [
  'Apply to jobs, send messages or fill in forms for you.',
  'Use sites that don’t allow it (such as LinkedIn or Wellfound). It only uses official public job feeds.',
  'Send your profile or saved jobs anywhere. They stay on your computer.',
] as const;

type BoardSource = 'greenhouse' | 'lever' | 'ashby';
const BOARD_SOURCES: readonly SourceId[] = ['greenhouse', 'lever', 'ashby'];

export default async function HowItWorksPage() {
  const loaded = await loadRadar();
  if (!loaded.ok) return <SetupProblem error={loaded.error} />;
  const { radar } = loaded;

  return (
    <div>
      <PageHeader
        title="How it works"
        intro="Remote Radar is a helper for your job search. It does the searching and sorting; every decision and every application is yours."
      />

      <Section title="From job boards to your list, in five steps">
        <ol className="grid gap-3 md:grid-cols-5">
          {PIPELINE.map((step, i) => (
            <li key={step.title} className="relative">
              <Card className="h-full">
                <p className="text-accent text-xs font-semibold tracking-wide uppercase">
                  Step {i + 1}
                </p>
                <h3 className="mt-1 font-semibold">{step.title}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Where the jobs come from">
        <p className="text-muted mb-4 max-w-2xl text-sm leading-relaxed">
          Only sources with an official, public way to read their jobs. Every job links back to its
          original listing, and that’s where you apply.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {radar.sources.map((source) => {
            const boards = BOARD_SOURCES.includes(source.id)
              ? radar.boards[source.id as BoardSource]
              : undefined;
            return (
              <li key={source.id}>
                <Card className="h-full">
                  <a
                    href={source.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold hover:underline"
                  >
                    {source.name}
                  </a>
                  <p className="text-muted mt-1 text-sm leading-relaxed">
                    {SOURCE_DESCRIPTIONS[source.id]}
                  </p>
                  {boards && (
                    <p className="text-muted mt-2 text-sm">
                      <span className="text-text font-medium">
                        {boards.length} {boards.length === 1 ? 'company' : 'companies'}:
                      </span>{' '}
                      {boards.map((b) => b.company).join(', ')}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="text-muted mt-3 text-sm">
          Want other companies? Copy <code>boards.default.json</code> to <code>boards.json</code> in
          the project folder and edit the list.
        </p>
      </Section>

      <Section title="“Where can I work from?”">
        <p className="text-muted mb-4 max-w-2xl text-sm leading-relaxed">
          Remote doesn’t always mean “from anywhere”. Each job gets one of these labels, based on
          what the listing says:
        </p>
        <dl className="bg-surface border-border divide-border divide-y rounded-xl border">
          {REMOTE_SCOPES.map((scope) => (
            <div key={scope} className="grid gap-1 px-5 py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-medium">{SCOPE_LABELS[scope].label}</dt>
              <dd className="text-muted text-sm">{SCOPE_LABELS[scope].hint}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="What the warnings mean">
        <p className="text-muted mb-4 max-w-2xl text-sm leading-relaxed">
          When a job is compared with your profile, it can get warnings. Each warning shows the
          exact sentence from the listing it’s based on, so you can judge it yourself. They’re
          hints, not decisions: a computer reading a listing can be wrong.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {RED_FLAG_CODES.map((code) => (
            <Card key={code}>
              <dt className="font-medium">⚠ {RED_FLAG_LABELS[code].title}</dt>
              <dd className="text-muted mt-1 text-sm leading-relaxed">
                {RED_FLAG_LABELS[code].explain}
              </dd>
            </Card>
          ))}
        </dl>
      </Section>

      <Section title="What it will never do">
        <ul className="space-y-2">
          {NEVER.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="text-bad font-semibold">
                ✕
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Where your data lives">
        <Callout tone="neutral" title="Everything stays on your computer">
          Your profile is a file in the project folder (<code>profile.json</code>). Saved jobs, your
          cover letter drafts and the job cache are in a small database that runs on your computer
          in Docker. If you also use Remote Radar from Claude, both see the same saved jobs.
        </Callout>
      </Section>
    </div>
  );
}
