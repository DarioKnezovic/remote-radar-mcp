import { describe, expect, it } from 'vitest';
import { matchJob, placeFit, type RedFlagCode } from '../../src/domain/match.js';
import { canonicalSkill, detectSkills, mentionsSkill } from '../../src/domain/skills.js';
import { makeJob, makeProfile } from '../helpers.js';

const profile = makeProfile();

function flagCodes(description: string, overrides: Parameters<typeof makeJob>[0] = {}) {
  return matchJob(makeJob({ description, ...overrides }), profile).red_flags.map((f) => f.code);
}

function expectFlag(
  code: RedFlagCode,
  description: string,
  overrides?: Parameters<typeof makeJob>[0],
) {
  expect(flagCodes(description, overrides)).toContain(code);
}

function expectNoFlag(
  code: RedFlagCode,
  description: string,
  overrides?: Parameters<typeof makeJob>[0],
) {
  expect(flagCodes(description, overrides)).not.toContain(code);
}

describe('skills', () => {
  it('recognises common spellings', () => {
    expect(canonicalSkill('node')).toBe('Node.js');
    expect(canonicalSkill('nodejs')).toBe('Node.js');
    expect(canonicalSkill('Postgres')).toBe('PostgreSQL');
    expect(canonicalSkill('ci/cd')).toBe('CI/CD');
    expect(canonicalSkill('Basket weaving')).toBeUndefined();
  });

  it('avoids classic false positives', () => {
    expect(detectSkills('Strong JavaScript skills')).not.toContain('Java');
    expect(detectSkills('Go to market strategy')).not.toContain('Go');
    expect(detectSkills('Please express interest')).not.toContain('Express.js');
    expect(detectSkills('React Native apps')).toEqual(['React Native']);
  });

  it('detects Go in programming context', () => {
    expect(detectSkills('Backend services in Go and Rust')).toEqual(
      expect.arrayContaining(['Go', 'Rust']),
    );
    expect(detectSkills('We use Golang')).toContain('Go');
  });

  it('matches unknown profile skills by whole word', () => {
    expect(mentionsSkill('Experience with Storybook required', 'Storybook')).toBe(true);
    expect(mentionsSkill('Storybooks', 'Storybook')).toBe(false);
  });
});

describe('matchJob: skills', () => {
  it('reports matched skills with level, missing skills and coverage', () => {
    const result = matchJob(
      makeJob({
        title: 'Senior Full-stack Engineer',
        tags: [],
        description:
          '<p>We use TypeScript, React, Node.js and Postgres. Kubernetes and Rust are a plus.</p>',
      }),
      profile,
    );
    expect(result.matched_skills).toEqual([
      { skill: 'TypeScript', level: 'strong' },
      { skill: 'React', level: 'strong' },
      { skill: 'Node.js', level: 'strong' },
      { skill: 'PostgreSQL', level: 'strong' },
      { skill: 'Rust', level: 'some' },
    ]);
    expect(result.missing_skills).toEqual(['Kubernetes']);
    expect(result.skill_coverage).toBe(0.83);
  });

  it('has null coverage when no known skills are mentioned', () => {
    const result = matchJob(
      makeJob({ title: 'Office Manager', tags: [], description: 'Keep the office running.' }),
      profile,
    );
    expect(result.skill_coverage).toBeNull();
  });
});

describe('matchJob: red flags', () => {
  it('on-site and hybrid', () => {
    expectFlag('on_site', '', { remote_scope: 'On-site', location: 'Dublin' });
    expectFlag('hybrid', '', { remote_scope: 'On-site', location: 'Hybrid (UK)' });
    expectNoFlag('on_site', '', { remote_scope: 'Worldwide' });
  });

  it('region restrictions relative to where the user lives (Europe)', () => {
    expectFlag('region_restricted', '', { remote_scope: 'US only', location: 'USA' });
    expectFlag('region_restricted', '', { remote_scope: 'Americas', location: 'Canada' });
    expectFlag('region_restricted', '', { remote_scope: 'Multi-region', location: 'USA, APAC' });
    expectNoFlag('region_restricted', '', {
      remote_scope: 'Multi-region',
      location: 'Europe, USA, APAC',
    });
    expectNoFlag('region_restricted', '', { remote_scope: 'Europe', location: 'Europe' });
  });

  it('"EU only" is ambiguous for an EU citizen living outside the EU, and says so', () => {
    const result = matchJob(makeJob({ remote_scope: 'EU only', location: 'EU' }), profile);
    expect(result.red_flags).toEqual([
      expect.objectContaining({
        code: 'region_restricted',
        message: expect.stringContaining('EU work authorization (which you have)') as string,
      }),
    ]);
  });

  it('EU residence requirements (the user lives in Bosnia and Herzegovina)', () => {
    expectFlag('residence_required', '<p>You must be based in the EU.</p>');
    expectFlag('residence_required', '<p>This role is open to EU residents only.</p>');
    expectFlag('residence_required', '<p>Candidates must reside within the European Union.</p>');
    expectNoFlag('residence_required', '<p>We are a company based in Berlin.</p>');
    expect(
      matchJob(
        makeJob({ description: 'You must be based in the EU.' }),
        makeProfile({
          location: { country: 'Croatia', country_code: 'HR', timezone: 'CET' },
        }),
      ).red_flags,
    ).toEqual([]);
  });

  it('listed hiring countries are compared with where the user lives, not the broad scope', () => {
    // n8n-style list: Croatia (a citizenship) is listed, Bosnia (home) isn't.
    const croatiaListed = matchJob(
      makeJob({
        remote_scope: 'Europe',
        location: 'Berlin Office; Romania; Serbia; Croatia; The Netherlands; Kosovo',
      }),
      profile,
    ).red_flags;
    expect(croatiaListed).toEqual([
      expect.objectContaining({
        code: 'region_restricted',
        message: expect.stringContaining("Croatia is listed and you're a citizen") as string,
      }),
    ]);

    expectFlag('region_restricted', '', { remote_scope: 'Europe', location: 'Remote, Poland' });
    expectFlag('region_restricted', '', { remote_scope: 'Europe', location: 'Germany (Remote)' });
    expectFlag('region_restricted', '', {
      remote_scope: 'Multi-region',
      location: 'Remote, Canada; Remote, Israel; Remote, United Kingdom',
    });

    const homeListed = matchJob(
      makeJob({ remote_scope: 'Europe', location: 'Berlin Office; Bosnia; Croatia' }),
      profile,
    );
    expect(homeListed.red_flags).toEqual([]);
    expect(homeListed.notes).toContain(
      'Bosnia and Herzegovina is explicitly listed as a hiring country.',
    );

    // A region anywhere in the list, or no country at all, leaves it to the scope check.
    expectNoFlag('region_restricted', '', { remote_scope: 'Europe', location: 'Europe; Germany' });
    expectNoFlag('region_restricted', '', {
      remote_scope: 'Europe',
      location: 'London; Stockholm',
    });
    expectNoFlag('region_restricted', '', {
      remote_scope: 'Multi-region',
      location: 'Home Based - Americas; Home based - EMEA',
    });
  });

  it('country residence requirements', () => {
    expectFlag('residence_required', '<p>You must be based in Germany.</p>');
    expectNoFlag('residence_required', '<p>You must be based in Bosnia and Herzegovina.</p>');
  });

  it('EU work authorization is satisfied by EU citizenship; US is not', () => {
    const eu = matchJob(
      makeJob({ description: 'You must be authorized to work in the EU.' }),
      profile,
    );
    expect(eu.red_flags).toEqual([]);
    expect(eu.notes).toContain(
      'Requires the right to work in EU: you have it through EU citizenship.',
    );

    const germany = matchJob(
      makeJob({ description: 'Must be eligible to work in Germany.' }),
      profile,
    );
    expect(germany.red_flags).toEqual([]);

    expectFlag(
      'work_authorization',
      '<p>Must be legally authorized to work in the United States.</p>',
    );
    expectFlag('work_authorization', '<p>US citizens only due to security clearance.</p>');
  });

  it('required languages, but not nice-to-haves or languages the user speaks', () => {
    expectFlag('language_required', '<p>Fluent German is required.</p>');
    expectFlag('language_required', '<p>German (C1) and English.</p>');
    expectFlag('language_required', '<p>Sehr gute Deutschkenntnisse in Wort und Schrift.</p>');
    expectFlag('language_required', '<p>You speak fluent French.</p>');
    expectNoFlag('language_required', '<p>German is a plus.</p>');
    expectNoFlag('language_required', '<p>Fluent English required.</p>');
    expectNoFlag('language_required', '<p>Native Croatian speaker welcome.</p>');

    const plus = matchJob(makeJob({ description: 'Fluent German is a big plus.' }), profile);
    expect(plus.notes).toContain('German is mentioned as a plus, not a requirement.');
  });

  it('postings written in another language', () => {
    const german =
      '<p>Wir suchen dich für unser Team in Berlin. Du arbeitest mit uns an der Plattform und bist für die ' +
      'Weiterentwicklung verantwortlich. Bei uns ist das Team klein und die Wege sind kurz. Du hast Erfahrung mit ' +
      'React und bist offen für Neues. Wir bieten dir eine faire Bezahlung und eine Kultur, die auf Vertrauen ' +
      'setzt. Das klingt gut? Dann freuen wir uns auf deine Bewerbung und die Gespräche mit dir und dem Team.</p>';
    expectFlag('posting_language', german);
    expectNoFlag(
      'posting_language',
      '<p>We are looking for an engineer to join the team and work with us on the platform. ' +
        'You will build things with the team and our customers. '.repeat(4) +
        '</p>',
    );
  });

  it('employment type the user is not looking for', () => {
    expectFlag('employment_type', '', { employment_type: 'part_time' });
    expectFlag('employment_type', '', { employment_type: 'internship' });
    expectFlag('employment_type', '', {
      employment_type: 'unknown',
      title: 'Part-time React Developer',
    });
    expectNoFlag('employment_type', '', { employment_type: 'contract' });
    expectNoFlag('employment_type', '', { employment_type: 'unknown' });
  });

  it('unpaid or equity-only', () => {
    expectFlag('unpaid', '<p>This is an unpaid internship.</p>');
    expectFlag('unpaid', '<p>Compensation is equity-only for now.</p>');
    expectNoFlag('unpaid', '<p>Competitive salary and equity.</p>');
  });

  it('US working hours for a user on CET', () => {
    expectFlag('timezone', '<p>You must overlap with PST business hours.</p>');
    expectFlag('timezone', '<p>Work US business hours.</p>');
    expectNoFlag('timezone', '<p>A team of 260 working across Europe and the US.</p>');
    expectFlag('timezone', '<p>Core hours overlap with US Eastern time.</p>');
    const cet = matchJob(makeJob({ description: 'Our team works in CET.' }), profile);
    expect(cet.red_flags).toEqual([]);
    expect(cet.notes).toContain('Mentions CET or European working hours.');
  });

  it('years of experience above the profile (only when the profile says how many)', () => {
    expectFlag('experience', '<p>10+ years of experience with React.</p>');
    expectNoFlag('experience', '<p>5+ years of experience.</p>');
    const noYears = matchJob(
      makeJob({ description: '15+ years of experience.' }),
      makeProfile({ years_experience: null }),
    );
    expect(noYears.red_flags).toEqual([]);
  });

  it('includes the evidence sentence', () => {
    const [flag] = matchJob(
      makeJob({ description: '<p>Great team. Fluent German is required. Nice office.</p>' }),
      profile,
    ).red_flags;
    expect(flag?.evidence).toBe('Fluent German is required.');
  });

  it('a clean, well-matched job has no red flags', () => {
    const result = matchJob(
      makeJob({
        title: 'Senior Frontend Engineer',
        remote_scope: 'Europe',
        location: 'Remote (Europe)',
        employment_type: 'full_time',
        description: '<p>Remote in Europe, CET ±2h. TypeScript and React. Competitive salary.</p>',
      }),
      profile,
    );
    expect(result.red_flags).toEqual([]);
  });
});

describe('placeFit', () => {
  // The default profile lives in Bosnia and Herzegovina (not in the EU), a Croatian citizen.
  it.each([
    ['Remote: Croatia, Bosnia and Herzegovina, Serbia', 'Europe', 3],
    ['Europe', 'Europe', 2],
    ['Worldwide', 'Worldwide', 2],
    ['Remote', 'Unknown', 1],
    ['Remote Germany', 'Europe', 0], // hires in Germany only
    ['EU', 'EU only', 0],
    ['Remote - US', 'US only', 0],
    ['Sarajevo', 'On-site', 0],
  ] as const)('%s (%s) → %i', (location, remote_scope, expected) => {
    expect(placeFit(makeJob({ location, remote_scope }), profile)).toBe(expected);
  });
});
