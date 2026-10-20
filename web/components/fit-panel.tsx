import Link from 'next/link';
import type { MatchResult, SkillLevel } from 'remote-radar-mcp/domain';
import { RED_FLAG_LABELS } from '@/lib/labels';
import { Badge, Callout } from './ui';

const LEVEL_LABELS: Record<SkillLevel, string> = {
  strong: '',
  some: 'some experience',
  learning: 'learning',
};

/** "How well this fits you": warnings with their evidence, good-to-know notes, and skills. */
export function FitPanel({ fit }: { fit: MatchResult | undefined }) {
  if (!fit) {
    return (
      <Callout tone="neutral" title="How well does this fit you?">
        Set up your profile and Remote Radar will check this job for you: matching skills, and
        catches like where you must live.{' '}
        <Link href="/profile" className="font-medium underline underline-offset-2">
          Set up my profile
        </Link>
      </Callout>
    );
  }

  const skillsTotal = fit.matched_skills.length + fit.missing_skills.length;
  const warnings = fit.red_flags.length;

  return (
    <section
      aria-labelledby="fit-heading"
      className="bg-surface border-border rounded-xl border p-5"
    >
      <h2 id="fit-heading" className="text-lg font-semibold">
        How well this fits you
      </h2>

      <div className="mt-4">
        {warnings === 0 ? (
          <p className="text-good font-medium">✓ No warnings found for your profile</p>
        ) : (
          <>
            <p className="text-warn font-medium">
              ⚠ {warnings === 1 ? '1 thing' : `${warnings} things`} to check before applying
            </p>
            <ul className="mt-3 space-y-3">
              {fit.red_flags.map((flag, i) => (
                <li key={`${flag.code}-${i}`} className="bg-warn-soft rounded-lg p-4">
                  <p className="font-medium">{RED_FLAG_LABELS[flag.code].title}</p>
                  <p className="mt-1 text-sm leading-relaxed">{flag.message}</p>
                  {flag.evidence && (
                    <blockquote className="border-warn/40 text-muted mt-2 border-l-2 pl-3 text-sm italic">
                      From the listing: “{flag.evidence}”
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {fit.notes.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Good to know</h3>
          <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-sm">
            {fit.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Skills</h3>
        {skillsTotal === 0 ? (
          <p className="text-muted mt-1 text-sm">
            The listing doesn’t name any skills Remote Radar recognises.
          </p>
        ) : (
          <>
            <p className="text-muted mt-1 text-sm">
              You have {fit.matched_skills.length} of the {skillsTotal} skills this listing
              mentions.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {fit.matched_skills.map(({ skill, level }) => (
                <Badge key={skill} tone="good">
                  ✓ {skill}
                  {LEVEL_LABELS[level] && ` · ${LEVEL_LABELS[level]}`}
                </Badge>
              ))}
              {fit.missing_skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
            {fit.missing_skills.length > 0 && (
              <p className="text-muted mt-2 text-xs">
                Grey: mentioned in the listing, not in your profile. Often “nice to have”.
              </p>
            )}
          </>
        )}
      </div>

      <p className="text-muted border-border mt-5 border-t pt-4 text-xs leading-relaxed">
        This is an automatic check of the listing’s text. It can miss things or get them wrong, so
        always read the original listing before you apply.
      </p>
    </section>
  );
}
