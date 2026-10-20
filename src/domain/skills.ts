import { foldText } from './text.js';

interface SkillDefinition {
  name: string;
  patterns: readonly RegExp[];
}

/**
 * Skills recognised in listings, with the spellings they appear under. Ambiguous names
 * are guarded: "Go" only counts next to programming context ("Go to market" doesn't),
 * "Express" only as Express.js ("express interest" doesn't), "Java" never matches
 * "JavaScript".
 */
const CATALOG: readonly SkillDefinition[] = [
  { name: 'TypeScript', patterns: [/\btypescript\b/i] },
  { name: 'JavaScript', patterns: [/\bjavascript\b/i, /\bJS\b/, /\becmascript\b/i, /\bES6\b/] },
  { name: 'React', patterns: [/\breact(?:\.?js)?\b(?![\s-]*native)/i] },
  { name: 'React Native', patterns: [/\breact[\s-]*native\b/i] },
  { name: 'Next.js', patterns: [/\bnext\.?js\b/i] },
  { name: 'Node.js', patterns: [/\bnode\.?js\b/i, /\bNode\b/] },
  { name: 'Angular', patterns: [/\bangular(?:js)?\b/i] },
  { name: 'Vue.js', patterns: [/\bvue(?:\.?js)?\b/i, /\bnuxt(?:\.?js)?\b/i] },
  { name: 'Svelte', patterns: [/\bsvelte(?:kit)?\b/i] },
  { name: 'Redux', patterns: [/\bredux\b/i] },
  { name: 'Tailwind CSS', patterns: [/\btailwind(?:\s*css)?\b/i] },
  { name: 'GraphQL', patterns: [/\bgraphql\b/i] },
  { name: 'Express.js', patterns: [/\bexpress\.?js\b/i] },
  { name: 'NestJS', patterns: [/\bnest\.?js\b/i] },
  { name: 'PostgreSQL', patterns: [/\bpostgres(?:ql)?\b/i] },
  { name: 'MySQL', patterns: [/\bmysql\b/i] },
  { name: 'MongoDB', patterns: [/\bmongo(?:db)?\b/i] },
  { name: 'Redis', patterns: [/\bredis\b/i] },
  { name: 'Elasticsearch', patterns: [/\belastic\s?search\b/i] },
  { name: 'Kafka', patterns: [/\bkafka\b/i] },
  { name: 'Docker', patterns: [/\bdocker\b/i] },
  { name: 'Kubernetes', patterns: [/\bkubernetes\b/i, /\bk8s\b/i] },
  {
    name: 'CI/CD',
    patterns: [
      /\bci\s*\/\s*cd\b/i,
      /\bcontinuous (?:integration|delivery|deployment)\b/i,
      /\bgithub actions\b/i,
      /\bgitlab ci\b/i,
    ],
  },
  { name: 'Terraform', patterns: [/\bterraform\b/i] },
  { name: 'AWS', patterns: [/\baws\b/i, /\bamazon web services\b/i] },
  { name: 'AWS Lambda', patterns: [/\blambda\b/i] },
  { name: 'GCP', patterns: [/\bgcp\b/i, /\bgoogle cloud\b/i] },
  { name: 'Azure', patterns: [/\bazure\b/i] },
  { name: 'Python', patterns: [/\bpython\b/i] },
  { name: 'Django', patterns: [/\bdjango\b/i] },
  { name: 'FastAPI', patterns: [/\bfastapi\b/i] },
  { name: 'Rust', patterns: [/\brust\b/i] },
  {
    name: 'Go',
    patterns: [
      /\bgolang\b/i,
      /\bGo\b(?=\s*(?:,|\/|\)|developer|engineer|services|backend|microservices|programming))/,
      /(?:,|\/|\(|\band|\bor|\bin|\busing|\bwith)\s+Go\b(?!\s+(?:to|live|beyond|above))/,
    ],
  },
  { name: 'Java', patterns: [/\bjava\b(?!\s*script)/i] },
  { name: 'Kotlin', patterns: [/\bkotlin\b/i] },
  { name: 'Swift', patterns: [/\bswift\b/i] },
  { name: 'C#', patterns: [/\bc#/i, /\.net\b/i, /\bdotnet\b/i] },
  { name: 'C++', patterns: [/\bc\+\+/i] },
  { name: 'PHP', patterns: [/\bphp\b/i, /\blaravel\b/i, /\bsymfony\b/i] },
  { name: 'Ruby', patterns: [/\bruby\b/i, /\brails\b/i] },
  { name: 'Elixir', patterns: [/\belixir\b/i] },
  { name: 'Scala', patterns: [/\bscala\b/i] },
  { name: 'Flutter', patterns: [/\bflutter\b/i] },
  { name: 'Jest', patterns: [/\bjest\b/i] },
  { name: 'Playwright', patterns: [/\bplaywright\b/i] },
  { name: 'Cypress', patterns: [/\bcypress\b/i] },
];

const BY_NAME = new Map(CATALOG.map((skill) => [foldText(skill.name), skill]));

/** Catalog name for a skill as a person writes it ("node", "Postgres", "ci/cd"), if known. */
export function canonicalSkill(input: string): string | undefined {
  const folded = foldText(input.trim());
  const direct = BY_NAME.get(folded);
  if (direct) return direct.name;
  // The input is a skill name, not prose, so case-sensitive guards (e.g. "Node") can relax.
  return CATALOG.find((skill) =>
    skill.patterns.some((pattern) =>
      new RegExp(
        pattern.source,
        pattern.flags.includes('i') ? pattern.flags : `${pattern.flags}i`,
      ).test(input),
    ),
  )?.name;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if `text` mentions the skill. Unknown skills fall back to a whole-word match. */
export function mentionsSkill(text: string, skill: string): boolean {
  const known = CATALOG.find((entry) => entry.name === canonicalSkill(skill));
  if (known) return known.patterns.some((pattern) => pattern.test(text));
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(skill)}(?![\\p{L}\\p{N}])`, 'iu').test(
    text,
  );
}

/** Every catalog skill mentioned in `text`, in catalog order. */
export function detectSkills(text: string): string[] {
  return CATALOG.filter((skill) => skill.patterns.some((pattern) => pattern.test(text))).map(
    (skill) => skill.name,
  );
}
