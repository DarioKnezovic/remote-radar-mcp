import { describe, expect, it } from 'vitest';
import {
  coverLetterPromptIntro,
  draftCoverLetter,
  NAME_PLACEHOLDER,
  pickStory,
  STORY_PLACEHOLDER,
} from '../../src/domain/cover-letter.js';
import { matchJob } from '../../src/domain/match.js';
import { makeJob, makeProfile } from '../helpers.js';

const job = makeJob({
  title: 'Senior Frontend Engineer',
  company: 'Northwind Labs',
  remote_scope: 'Europe',
  location: 'Europe',
  description: '<p>We use TypeScript, React and Node.js. Experience with Python is a plus.</p>',
});

const stories = [
  {
    title: 'Built an internal CLI',
    summary: 'Wrote a Rust CLI for deployments',
    skills: ['Rust'],
  },
  {
    title: 'Cut checkout load time in half',
    summary: 'Moved a React checkout to server-side rendering; load time went from 6.1s to 2.8s.',
    skills: ['React', 'node'],
  },
];

function draft(profile = makeProfile({ stories }), target = job) {
  return draftCoverLetter({ job: target, profile, fit: matchJob(target, profile) });
}

describe('draftCoverLetter', () => {
  it('names the role and company, and the matching skills the user has', () => {
    const text = draft();
    expect(text).toMatch(/^Dear Northwind Labs team,/);
    expect(text).toContain("I'm applying for the Senior Frontend Engineer role at Northwind Labs.");
    expect(text).toContain(
      "role at Northwind Labs. I'm a software developer with 8 years of professional experience",
    );
    expect(text).toContain('working mostly with TypeScript, React and Node.js');
  });

  it('never claims a "learning" skill as experience', () => {
    const text = draft();
    expect(text).not.toMatch(/working mostly with[^.]*Python/);
    expect(text).toContain("I'm currently learning Python as well.");
  });

  it('uses the achievement that shares the most skills with the listing', () => {
    expect(pickStory(makeProfile({ stories }), matchJob(job, makeProfile()))?.title).toBe(
      'Cut checkout load time in half',
    );
    expect(draft()).toContain(
      'One example of my work: Cut checkout load time in half. Moved a React checkout',
    );
  });

  it('leaves clear placeholders instead of inventing missing details', () => {
    const text = draft(makeProfile({ stories: [] }));
    expect(text).toContain(STORY_PLACEHOLDER);
    expect(text).toMatch(new RegExp(`Best regards,\\n\\${NAME_PLACEHOLDER}$`));
    expect(draft(makeProfile({ name: 'Ana Horvat' }))).toMatch(/Best regards,\nAna Horvat$/);
  });

  it('mentions EU citizenship for a European role only when the user lives outside the EU', () => {
    const eu = 'I hold EU citizenship';
    expect(draft()).toContain(eu); // lives in Bosnia and Herzegovina, Croatian citizen
    expect(
      draft(makeProfile({ location: { country: 'Croatia', country_code: 'HR', timezone: 'CET' } })),
    ).not.toContain(eu);
    expect(draft(makeProfile(), { ...job, remote_scope: 'Worldwide' })).not.toContain(eu);
    expect(draft(makeProfile({ citizenship: ['BA'] }))).not.toContain(eu);
  });

  it('says where the user works from', () => {
    expect(draft()).toContain('I work remotely from Mostar, Bosnia and Herzegovina (CET).');
  });

  it('omits experience years when the profile has none', () => {
    expect(draft(makeProfile({ years_experience: null }))).toContain(
      "I'm a software developer, working mostly with",
    );
  });
});

describe('coverLetterPromptIntro', () => {
  it('gives the assistant the listing, the profile and the fit, ending where the draft goes', () => {
    const profile = makeProfile({ stories });
    const prompt = coverLetterPromptIntro({ job, profile, fit: matchJob(job, profile) });
    expect(prompt).toContain('never invent skills, numbers, employers or projects');
    expect(prompt).toContain('Senior Frontend Engineer at Northwind Labs');
    expect(prompt).toContain('We use TypeScript, React and Node.js.');
    expect(prompt).toContain('Strong skills: TypeScript, React, Node.js, PostgreSQL');
    expect(prompt).toContain('- Cut checkout load time in half: Moved a React checkout');
    expect(prompt).toContain('Learning: Python');
    expect(prompt.endsWith('## My current draft\n')).toBe(true);
  });
});
