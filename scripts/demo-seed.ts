/**
 * Fills a *demo* database with made-up jobs, so the web app can be shown (or screenshotted)
 * without calling any job API and without real listings, whose terms restrict republishing.
 *
 * The jobs are recorded as a fresh fetch from each source, so searches use them instead
 * of fetching (until the cache expires, 1–6 hours). Refuses to touch a database whose
 * name doesn't contain "demo".
 *
 *   docker compose exec postgres createdb -U remote_radar remote_radar_demo
 *   DATABASE_URL=postgres://remote_radar:remote_radar@localhost:5433/remote_radar_demo npm run demo:seed
 *   DATABASE_URL=…/remote_radar_demo PROFILE_FILE=profile.example.json npm run web:dev
 */
import { loadConfig } from '../src/config.js';
import { JobRepository } from '../src/db/job-repository.js';
import { migrate } from '../src/db/migrate.js';
import { createPool } from '../src/db/pool.js';
import { makeJobId, SOURCE_IDS, type Job, type SourceId } from '../src/domain/job.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();

type DemoJob = Omit<Job, 'id' | 'source_job_id' | 'url'> & { slug: string };

const html = (...paragraphs: string[]) => paragraphs.map((p) => `<p>${p}</p>`).join('');

const DEMO_JOBS: DemoJob[] = [
  {
    slug: 'northwind-senior-frontend',
    source: 'remotive',
    title: 'Senior Frontend Engineer (React)',
    company: 'Northwind Labs',
    location: 'Europe',
    remote_scope: 'Europe',
    employment_type: 'full_time',
    salary: '€70,000–90,000 per year',
    tags: ['react', 'typescript'],
    published_at: daysAgo(1),
    description: html(
      'Northwind Labs builds planning tools for small logistics teams. We are fully remote across Europe.',
      'You will lead our React and TypeScript frontend, work closely with design, and help us move to Next.js.',
      '<strong>You have:</strong> 5+ years of frontend work, strong TypeScript and React, experience with GraphQL or REST APIs.',
      'We work in CET ±2 hours. Full-time, permanent contract.',
    ),
  },
  {
    slug: 'brightloop-frontend-lead',
    source: 'remoteok',
    title: 'Frontend Lead',
    company: 'Brightloop',
    location: 'Worldwide',
    remote_scope: 'Worldwide',
    employment_type: 'full_time',
    salary: 'USD 110,000–140,000 per year',
    tags: ['react', 'next.js', 'lead'],
    published_at: daysAgo(2),
    description: html(
      'Brightloop makes accessible forms for public services. Our team of 20 works from 11 countries.',
      'As Frontend Lead you set the direction for our Next.js app, mentor three engineers and own our CI/CD pipeline.',
      'Our stack: TypeScript, React, Next.js, Node.js, PostgreSQL, Docker.',
    ),
  },
  {
    slug: 'tidewater-fullstack',
    source: 'greenhouse',
    title: 'Full-Stack Engineer (Node.js / React)',
    company: 'Tidewater Health',
    location: 'Remote, Germany; Remote, Netherlands',
    remote_scope: 'Europe',
    employment_type: 'full_time',
    salary: null,
    tags: [],
    published_at: daysAgo(4),
    description: html(
      'Tidewater Health helps clinics schedule appointments. We hire through our entities in Germany and the Netherlands.',
      'You will build features end to end with Node.js, React and PostgreSQL, and care about tests (Jest, Playwright).',
    ),
  },
  {
    slug: 'kestrel-frontend',
    source: 'lever',
    title: 'Senior Software Engineer, Frontend',
    company: 'Kestrel Analytics',
    location: 'Remote - US',
    remote_scope: 'US only',
    employment_type: 'full_time',
    salary: 'USD 150,000–180,000 per year',
    tags: [],
    published_at: daysAgo(3),
    description: html(
      'Kestrel Analytics turns sensor data into dashboards. You must be authorized to work in the United States.',
      'React, TypeScript, D3 and a good eye for data visualisation.',
    ),
  },
  {
    slug: 'fernwerk-frontend',
    source: 'arbeitnow',
    title: 'Frontend Developer (m/w/d)',
    company: 'Fernwerk GmbH',
    location: 'Remote (Germany)',
    remote_scope: 'Europe',
    employment_type: 'full_time',
    salary: null,
    tags: ['vue.js', 'javascript'],
    published_at: daysAgo(6),
    description: html(
      'Fernwerk builds route planning for regional buses. You work on our Vue.js apps with TypeScript.',
      'Fließende Deutschkenntnisse (C1) sind erforderlich, da du eng mit unseren Kunden arbeitest.',
    ),
  },
  {
    slug: 'lumen-staff-product',
    source: 'ashby',
    title: 'Staff Product Engineer',
    company: 'Lumen & Co',
    location: 'Europe',
    remote_scope: 'Europe',
    employment_type: 'contract',
    salary: '€500–650 per day',
    tags: [],
    published_at: daysAgo(9),
    description: html(
      'Lumen & Co is a product studio. We are looking for a contractor to lead a new TypeScript, React and Node.js product for a fintech client.',
      'Twelve months to start, extension likely. Docker and AWS experience is a plus.',
    ),
  },
  {
    slug: 'pebble-part-time',
    source: 'remotive',
    title: 'Part-time React Developer',
    company: 'Pebble Studio',
    location: 'Worldwide',
    remote_scope: 'Worldwide',
    employment_type: 'part_time',
    salary: 'USD 40–55 per hour',
    tags: ['react'],
    published_at: daysAgo(12),
    description: html(
      'Twenty hours a week on our React Native and React apps for independent cafés.',
    ),
  },
  {
    slug: 'orbital-angular',
    source: 'ashby',
    title: 'Angular Engineer',
    company: 'Orbital Freight',
    location: 'EMEA',
    remote_scope: 'Multi-region',
    employment_type: 'full_time',
    salary: null,
    tags: [],
    published_at: daysAgo(15),
    description: html(
      'Orbital Freight books container shipping. Help us keep our Angular and RxJS dashboard fast and reliable.',
    ),
  },
];

function toJob(demo: DemoJob): Job {
  const { slug, ...rest } = demo;
  return {
    ...rest,
    id: makeJobId(demo.source, `demo-${slug}`),
    source_job_id: `demo-${slug}`,
    url: `https://example.com/jobs/${slug}`,
  };
}

/** Saved jobs, to fill the "My jobs" board. */
const TRACKED: {
  slug: string;
  steps: { status: 'applied' | 'interview'; note?: string }[];
  note?: string;
}[] = [
  { slug: 'northwind-senior-frontend', note: 'Great stack match. Ask about team size.', steps: [] },
  {
    slug: 'brightloop-frontend-lead',
    steps: [{ status: 'applied', note: 'Sent CV and portfolio through their site.' }],
  },
  {
    slug: 'lumen-staff-product',
    steps: [
      { status: 'applied' },
      { status: 'interview', note: 'First call with the CTO on Thursday.' },
    ],
  },
  { slug: 'tidewater-fullstack', steps: [] },
];

async function main() {
  const { databaseUrl } = loadConfig();
  const name = new URL(databaseUrl).pathname.slice(1);
  if (!name.includes('demo')) {
    throw new Error(`Refusing to seed "${name}": use a database whose name contains "demo".`);
  }

  const pool = createPool(databaseUrl);
  try {
    await migrate(pool);
    const repository = new JobRepository(pool);
    const jobs = DEMO_JOBS.map(toJob);
    const sources = [...new Set(jobs.map((job) => job.source))] as SourceId[];
    for (const source of SOURCE_IDS) {
      // Every source gets a fresh (possibly empty) fetch, so none is called for real.
      await repository.recordSuccessfulFetch(
        source,
        jobs.filter((job) => job.source === source),
        now,
      );
    }
    for (const tracked of TRACKED) {
      const id = jobs.find((job) => job.url.endsWith(`/${tracked.slug}`))?.id;
      if (!id) continue;
      await repository.saveJob(id, tracked.note);
      for (const step of tracked.steps) await repository.updateStatus(id, step.status, step.note);
    }
    console.error(
      `Seeded ${jobs.length} made-up jobs from ${sources.length} sources and ${TRACKED.length} saved jobs into "${name}".`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
