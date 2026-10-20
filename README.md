# Remote Radar MCP

An [MCP](https://modelcontextprotocol.io) server that helps you find remote developer jobs from
**official public job APIs**, and keeps track of the ones you care about in a local Postgres
database. Use it from Claude Desktop, Claude Code or any MCP client.

It finds, filters, dedupes, saves and tracks. **It never applies to jobs.** You read the listing
and apply yourself, on the original site.

- 🔎 **`search_jobs`**: one search across Remotive and Arbeitnow, normalized into a single job
  shape, with duplicates removed and filters for keywords, tags, remote region and posting date.
- 📌 **`save_job`, `update_job_status`, `list_saved_jobs`**: a small application tracker
  (`found → applied → interview → offer`, or `rejected` / `skipped`) with a dated notes log and a
  full status history.
- 📄 **`get_job_details`**: the full listing as clean text, plus its tracker status.
- 🤝 **Respects the sources**: official APIs only, rate limits enforced across restarts, source
  credit on every result.

> Built with TypeScript (strict), the official MCP TypeScript SDK, zod, PostgreSQL with plain SQL
> migrations, and Vitest.

---

## Demo

An example conversation in Claude Desktop. The companies and listings are made up; real results
depend on what the sources have that day.

> **You:** Find remote frontend or full-stack jobs I can do from Europe, posted in the last two
> weeks.
>
> **Claude:** _calls `search_jobs` with `{ "query": "react", "remote_scope": ["Worldwide", "Europe", "EU only"], "posted_within_days": 14 }`_
>
> I found 6 matches. The most relevant:
>
> 1. **Senior Full-Stack Engineer (React/Node)**, Acme Cloud. Worldwide, full-time,
>    $90k–$120k. _via Remotive_
> 2. **Frontend Lead (TypeScript)**, Globex GmbH. Remote in Europe (Germany), full-time.
>    _via Arbeitnow_
> 3. …
>
> **You:** Tell me more about the Globex one. Do they require German?
>
> **Claude:** _calls `get_job_details` with `{ "job_id": "arbeitnow:frontend-lead-typescript-berlin-12345" }`_
>
> The listing is in English and asks for "fluent English; German is a plus", so German isn't
> required. They want 6+ years with React and TypeScript, experience leading a small team, and
> CI/CD. Remote within Europe, with optional visits to the Berlin office.
>
> **You:** Save it. Note: strong stack match, ask about team size.
>
> **Claude:** _calls `save_job`._ Saved with status **found**.
>
> **You:** I applied through their careers page today.
>
> **Claude:** _calls `update_job_status` with `{ "status": "applied", "notes": "Applied via careers page" }`_
> Updated: found → **applied**.
>
> **You:** What's in my pipeline?
>
> **Claude:** _calls `list_saved_jobs`._ You have 3 saved jobs: 1 applied (Globex, today),
> 1 interview (Initech, since Oct 14), 1 found (Acme Cloud).

---

## Tools

| Tool                | Input                                                               | What it does                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search_jobs`       | `query?`, `tags?`, `remote_scope?`, `posted_within_days?`, `limit?` | Fetches from all sources (cached), normalizes, dedupes, filters, and returns up to `limit` (default 20, max 50) short job summaries, newest first. Includes per-source status and an attribution line. |
| `get_job_details`   | `job_id`                                                            | The full normalized job, description converted to plain text, plus tracker status if saved.                                                                                                            |
| `save_job`          | `job_id`, `notes?`                                                  | Saves the job with status `found`. Saving again keeps the status and appends the note.                                                                                                                 |
| `update_job_status` | `job_id`, `status`, `notes?`                                        | `status` is one of `found`, `applied`, `interview`, `offer`, `rejected`, `skipped`. Every change goes into the status history.                                                                         |
| `list_saved_jobs`   | `status?`                                                           | Saved jobs with status and notes, most recently updated first.                                                                                                                                         |

**Search filters**

- `query`: every word must appear as a whole word (case- and accent-insensitive) in the title,
  company, tags, location or description. `java` doesn't match "JavaScript"; `node.js` and `c++`
  work.
- `tags`: the job has at least one of these tags.
- `remote_scope`: one value or a list. Values: `Worldwide`, `Europe`, `EU only`, `US only`,
  `Americas`, `Multi-region`, `Other`, `Unknown`, `On-site`. A `Multi-region` job (e.g.
  "Europe, USA, APAC") matches `Europe` if Europe is in its list. Without this filter, on-site
  jobs are excluded.
- `posted_within_days`: 1–365.

Each tool returns **structured output** (with a declared output schema) plus a JSON text copy for
clients that don't support structured output yet. Read-only tools are annotated `readOnlyHint`;
only `save_job` and `update_job_status` write, and they only write to your local database.

**The normalized job shape**

```ts
{
  id: "remotive:2091158",        // "<source>:<source id>"
  source: "remotive" | "arbeitnow",
  url: string,                   // original listing: apply here
  title: string,
  company: string,
  location: string | null,       // raw text from the source
  remote_scope: RemoteScope,     // see above
  employment_type: "full_time" | "part_time" | "contract" | "freelance" | "internship" | "unknown",
  salary: string | null,         // raw text, not parsed
  tags: string[],
  description: string,           // HTML (plain text in get_job_details)
  published_at: string           // ISO 8601, UTC
}
```

---

## Setup

**Requirements:** Node.js 22.12+ and Docker (for Postgres).

```bash
git clone https://github.com/DarioKnezovic/remote-radar-mcp.git
cd remote-radar-mcp
npm install
npm run db:up      # Postgres 18 on localhost:5433
npm run build
```

The server runs database migrations automatically when it starts. You can also run them yourself
with `npm run db:migrate`.

> **Docker Desktop on macOS:** if `docker` says it can't connect to `/var/run/docker.sock`, run
> `docker context use desktop-linux` once.

### Connect to Claude Code

```bash
claude mcp add remote-radar -- node /absolute/path/to/remote-radar-mcp/dist/index.js
claude mcp list    # remote-radar should show as connected
```

### Connect to Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows), then fully quit and reopen Claude Desktop:

```json
{
  "mcpServers": {
    "remote-radar": {
      "command": "node",
      "args": ["/absolute/path/to/remote-radar-mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://remote_radar:remote_radar@localhost:5433/remote_radar"
      }
    }
  }
}
```

Postgres must be running before the client starts the server. If it isn't, the server exits with
_"Is Postgres running? Try `docker compose up -d`"_, which appears in the client's MCP logs.

### Try it without an AI client

```bash
npm run inspect    # opens the MCP Inspector in your browser
```

### Configuration

| Variable       | Default                                                            | Description                                          |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `DATABASE_URL` | `postgres://remote_radar:remote_radar@localhost:5433/remote_radar` | Matches `docker-compose.yml`.                        |
| `LOG_LEVEL`    | `info`                                                             | `debug`, `info`, `warn`, `error`. Logs go to stderr. |

---

## Architecture

```mermaid
flowchart LR
  client["Claude Desktop / Claude Code<br/>(MCP client)"]

  subgraph server["remote-radar MCP server (stdio)"]
    direction LR
    tools["tools/<br/>search_jobs · get_job_details<br/>save_job · update_job_status · list_saved_jobs"]
    search["JobSearchService<br/>merge → dedupe → filter → sort → limit"]
    domain["domain/<br/>Job · remote scope · filter · dedupe"]
    cache["CachedJobSource<br/>TTL · stale-on-error · retry throttle"]
    remotive["RemotiveSource"]
    arbeitnow["ArbeitnowSource"]
    repo["JobRepository<br/>(all SQL)"]
  end

  db[("PostgreSQL<br/>jobs · saved_jobs<br/>job_status_history · source_fetches")]
  rapi["remotive.com/api"]
  aapi["arbeitnow.com/api"]

  client <-->|JSON-RPC over stdio| tools
  tools --> search
  tools --> repo
  search --> domain
  search --> cache
  cache --> remotive & arbeitnow
  cache -->|FetchCacheStore| repo
  remotive -->|HTTPS, ≤ 4/day| rapi
  arbeitnow -->|HTTPS, ≤ 3 pages/hour| aapi
  repo --> db
```

**One search, step by step**

1. `search_jobs` asks `JobSearchService` for results.
2. Each source is wrapped in `CachedJobSource`. If the last successful fetch, recorded in
   Postgres, is still fresh (Remotive: 6 h, Arbeitnow: 1 h), the cached jobs are read from
   Postgres. Otherwise the source is called once, its jobs are upserted, and the fetch is
   recorded.
3. The source client validates the raw response with zod, one listing at a time, so one bad
   listing doesn't drop the whole feed, and normalizes it into a `Job`.
4. Jobs from all sources are merged, deduped, filtered, sorted and cut to `limit`.
5. A failing source shows up as `ok: false` in the result, and the other sources' jobs are still
   returned. The tool only reports an error if every source fails.

**Project layout**

```
src/
  index.ts            entry point: config, migrations, wiring, stdio transport
  server.ts           createServer(deps): registers all tools (used directly by tests)
  config.ts           env vars validated with zod
  domain/             pure logic, no I/O: Job, remote scope, filter, dedupe, text, application status
  sources/            JobSource interface, HTTP client, cache, registry
    remotive/         schema (raw API) · normalize · client
    arbeitnow/        schema (raw API) · normalize · client (pagination)
  services/           JobSearchService
  db/                 pool, migration runner, JobRepository, Postgres cache store
  tools/              one file per MCP tool + shared output schemas
migrations/           plain SQL, applied in order
test/
  fixtures/           recorded API responses (trimmed, see test/fixtures/README.md)
  unit/               no network, no database
  integration/        real Postgres, each file in its own temporary schema
```

---

## Development

| Command                     | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `npm run dev`               | Run from source with tsx                                 |
| `npm run build`             | Compile to `dist/`                                       |
| `npm test`                  | Unit tests (integration tests skip without a database)   |
| `npm run test:db`           | All tests, including Postgres integration tests          |
| `npm run test:coverage`     | All tests with a coverage report (`coverage/index.html`) |
| `npm run typecheck`         | `tsc --noEmit`                                           |
| `npm run lint`              | ESLint (typescript-eslint strict, type-checked)          |
| `npm run format`            | Prettier                                                 |
| `npm run db:up` / `db:down` | Start / stop Postgres                                    |
| `npm run inspect`           | Build and open the MCP Inspector                         |

**Tests never call the real APIs.** Normalization and dedupe are tested against responses
recorded from Remotive and Arbeitnow (`test/fixtures/`). The tool tests connect a real MCP client
to the server over an in-memory transport. Integration tests run the real migrations in a
throwaway Postgres schema.

### Adding a job source

1. Create `src/sources/<name>/` with `schema.ts` (zod schema of the raw API), `normalize.ts`
   (raw → `Job`) and `client.ts` (a class implementing `JobSource`).
2. Add the id to `SOURCE_IDS` in `src/domain/job.ts` and an attribution line to
   `SOURCE_ATTRIBUTION` in `src/tools/shared.ts`.
3. Register it in `src/sources/registry.ts` with a TTL that fits the source's rate limits.
4. Record a sample response into `test/fixtures/` (trimmed) and test the normalizer against it.

Nothing else changes: search, dedupe, caching and the tracker work on the normalized `Job`.

---

## Design decisions

**Why it never applies to jobs.** Applying is the step where your judgement matters most and
mistakes are hardest to undo: a generic auto-filled application can burn a good opportunity.
Many job boards also forbid automated applications. So the server's job is to find, filter and
remember. You read the listing and apply yourself. The tool descriptions and server
instructions say this explicitly, so the model doesn't offer to "apply for you" either.

**Why only official APIs.** Scraping sites that forbid it (LinkedIn, Wellfound and others) breaks
their terms and breaks whenever their HTML changes. Remotive and Arbeitnow both publish free
APIs. Their terms shape the code:

- **Rate limits:** Remotive advises at most 4 requests a day. Arbeitnow asks not to abuse its
  free API.
- **Attribution:** every result carries the source name and the original URL.
- **No republishing:** the test fixtures are trimmed samples rather than full copies of
  listings, and this README uses made-up listings.

**Why a `JobSource` interface, with caching as a separate wrapper.** Sources are messy in
different ways. Remotive gives free-text locations. Arbeitnow mixes languages in `job_types`,
sometimes reports remote jobs as `remote: false`, and sometimes puts the location in the title.
Each source keeps that mess in its own folder and outputs the same `Job`, so dedupe, filters
and the tracker are written once. Rate limiting is a separate concern, so `CachedJobSource` wraps
any source instead of each client caching on its own. Adding Greenhouse, Lever or Ashby is a new
folder and one line in the registry.

**Why the cache lives in Postgres.** MCP clients start a new server process for many sessions.
An in-memory cache would refetch on every start, which would quickly break Remotive's 4-per-day
limit. Fetches are recorded in `source_fetches`, and the jobs of the latest fetch are the rows
with `last_seen_at` at or after that fetch. This also means `get_job_details` works for any job
you've seen in a search, not only saved ones.

**Why filtering happens locally.** Remotive's documented `search` and `limit` parameters are
currently ignored by the free API, which always returns the latest 10 jobs. Arbeitnow has no
search parameters. Fetching the feed once and filtering locally behaves the same for every
source and costs nothing extra in requests.

**Why remote scope is conservative.** Location text is free-form. The classifier recognizes
regions (Worldwide, Europe, EU, US, Americas, APAC and others) and only picks a scope when the
text actually names one. "Remote" alone or a city name ("Berlin") stays `Unknown` rather than
guessed as `Europe`, because remote with a Berlin office often means remote within Germany only.
Region names in a title are used when the location has none ("…Remote from EU"), but "Global" or
"International" in a title is ignored ("Global Head of Sales").

**Dedupe rule and its trade-off.** Two listings are duplicates when the company matches after
cleanup (`Acme GmbH` = `Acme, Inc.`) and the titles' words overlap by at least 80%. Gender
markers like `(m/w/d)`, "Remote", and spelling variants like front-end/frontend are ignored, but
seniority words are kept: "Senior Frontend Engineer" is a different role than "Frontend
Engineer". The copy with more information (salary, known scope, tags) is kept. Trade-off: the
same role posted for two cities (Berlin and Karlsruhe) collapses into one result, and the second
city isn't shown.

**Why notes are a log.** Notes are appended, not overwritten
(`[2026-10-21 applied] Sent CV via careers page`), so a note added when saving ("referral from a
former colleague") survives later status changes. `job_status_history` keeps every transition.

**Why plain SQL instead of an ORM.** The schema is four tables. Hand-written SQL in a single
repository file is easy to read, uses Postgres features directly (bulk upsert via
`jsonb_to_recordset`, `CHECK` constraints, advisory locks for migrations), and has no build or
runtime magic. Migrations are numbered `.sql` files, each applied in a transaction.

**Why stdout is off limits.** With the stdio transport, stdout is the protocol channel, and one
stray `console.log` corrupts it. All logging goes to stderr as JSON lines, and ESLint rejects
`console.log`.

---

## Sources

| Source                                 | Endpoint                                          | Notes                                                                                                                       |
| -------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [Remotive](https://remotive.com)       | `GET https://remotive.com/api/remote-jobs`        | Free API returns the latest ~10 jobs, delayed 24 h. Cached 6 h (≤ 4 requests/day). Credit Remotive and link to the listing. |
| [Arbeitnow](https://www.arbeitnow.com) | `GET https://www.arbeitnow.com/api/job-board-api` | 300 jobs/page, mostly Germany/EU, mostly on-site. First 3 pages, cached 1 h. Personal, non-commercial use; link back.       |

Job data belongs to these sources and the companies that posted it. This project is for personal
job searching.

## Limitations

- Remotive's free API gives few jobs (about 10), so most results come from Arbeitnow, which is
  mostly German and on-site.
- Most Arbeitnow remote jobs end up with scope `Unknown`. Include `Unknown` in `remote_scope` to
  see them.
- Salaries are raw text (`"$50-$75 /hour"`, `"OTE $25k - $35k"`), and Arbeitnow has none, so
  there's no salary filter yet.

## Roadmap (v2)

- **More sources:** RemoteOK, and company boards on Greenhouse
  (`boards-api.greenhouse.io/v1/boards/{company}/jobs`), Lever
  (`api.lever.co/v0/postings/{company}?mode=json`) and Ashby
  (`api.ashbyhq.com/posting-api/job-board/{name}`).
- **`get_profile`:** reads a local, git-ignored `profile.json` (skills, experience, location,
  citizenship, stories).
- **`match_job { job_id }`:** compares a job with the profile and returns matched skills, missing
  skills and red flags. Examples: "requires German", "on-site", "US only", "part-time", "requires
  EU residence while you live outside the EU". This will be a pure function in
  `src/domain/match.ts` over the normalized job, which already keeps the full description for it.

## License

[MIT](LICENSE) © 2026 Dario Knezović. The license covers this code, not the job listings it
fetches, which belong to their sources.
