# Remote Radar

[![CI](https://github.com/DarioKnezovic/remote-radar-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/DarioKnezovic/remote-radar-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Remote Radar finds remote developer jobs from **official public job APIs**, checks each one
against your profile, warns you about catches like _"must live in Germany"_ or _"fluent German
required"_, and keeps track of the jobs you care about.

**It never applies to jobs.** You read the listing and apply yourself, on the company's own page.

There are two ways to use it, and they share the same data:

- 🖥️ **In your browser:** a web app at `http://localhost:3000`. No coding needed.
- 🤖 **From Claude:** an [MCP](https://modelcontextprotocol.io) server for Claude Desktop, Claude
  Code or any MCP client, so you can ask _"find frontend jobs I can do from Europe"_.

| Find jobs                                                                          | How well a job fits you                                                      |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ![Search results with fit summaries](docs/screenshots/find-jobs.jpg)               | ![A job page with warnings and matched skills](docs/screenshots/job-fit.jpg) |
| **My jobs**                                                                        | **Your profile**                                                             |
| ![Saved jobs by stage: Saved, Applied, Interviewing](docs/screenshots/my-jobs.jpg) | ![The first-run profile setup](docs/screenshots/profile-setup.jpg)           |

<sub>Screenshots use made-up jobs and a fictional profile.</sub>

---

## Quick start (no coding needed)

You need **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (free for personal
use). Install it and start it.

1. **Download Remote Radar.** On this page, click **Code → Download ZIP** and unzip it. (Or, if
   you use git: `git clone https://github.com/DarioKnezovic/remote-radar-mcp.git`.)
2. **Open a terminal in that folder.**
   - macOS: right-click the folder in Finder → **New Terminal at Folder**.
   - Windows: open the folder, click the address bar, type `cmd` and press Enter.
3. **Start it:**

   ```bash
   docker compose up -d --build
   ```

   The first start takes a few minutes. Later starts take seconds.

4. **Open [http://localhost:3000](http://localhost:3000)** and set up your profile: where you
   live, your citizenship, skills and languages. It takes about a minute.
5. Go to **Find jobs**. The first search takes a little longer, because the job lists are
   fetched; after that they're kept for a few hours.

| To…                                  | Run (in the same folder)                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Stop it                              | `docker compose down`                                                  |
| Start it again                       | `docker compose up -d`                                                 |
| Update to a new version              | download it again (or `git pull`), then `docker compose up -d --build` |
| Remove it, including your saved jobs | `docker compose down -v`, then delete the folder                       |

**Your data stays on your computer.** Your profile is saved as `profile.json` in the project
folder; saved jobs are in a small database inside Docker. Remote Radar only talks to the public job
APIs listed under [Sources](#sources), and never sends your profile anywhere. The app has no
login, so it only accepts connections from your own computer, not from your network.

<details>
<summary>Troubleshooting</summary>

- **macOS: "Cannot connect to the Docker daemon"**: make sure Docker Desktop is running. If it is,
  run `docker context use desktop-linux` once.
- **"port is already allocated"**: something else uses port 3000 or 5433. Stop it, or change the
  first number of the port in `docker-compose.yml` (e.g. `'127.0.0.1:3001:3000'`, then open
  `localhost:3001`).
- **Linux: "Cannot write …/profile.json"**: the app runs as user id 1000 unless told otherwise.
  Start it as your own user instead: `UID=$(id -u) GID=$(id -g) docker compose up -d --build`.
- **A source shows "didn't respond"**: that job board is down or slow. Its jobs are missing from
  that search; Remote Radar tries again a few minutes later.

</details>

---

## The web app

| Page             | What it does                                                                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Find jobs**    | Search by keywords, where you can work from (_open to where I live_, _anyone, anywhere_, _all remote jobs_) and how recent. Sort by best fit, or show only jobs with no warnings for you. Each result shows where it can be done from, the contract type, pay if listed, and a one-line fit summary. |
| **Job page**     | The full listing, and **How well this fits you**: each warning in plain words with the sentence from the listing it's based on, matched and missing skills, and a big **Open the original listing** button.                                                                                          |
| **My jobs**      | Saved jobs by stage: Saved → Applied → Interviewing → Offer, plus Rejected and Not interested. Mark a job **I applied** after applying on the company's site, change its stage, and add notes.                                                                                                       |
| **My profile**   | A form for your profile, with a three-step setup the first time. Countries and time zones are dropdowns; skills are understood in their common spellings ("node" → Node.js).                                                                                                                         |
| **How it works** | The whole process in five steps, every source, what each "where can I work from" label and each warning means, and what Remote Radar never does.                                                                                                                                                     |

To run the web app without Docker (for development), see [Development](#development).

---

## Use it from Claude

### Demo

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
> **Claude:** _calls `match_job` with `{ "job_id": "arbeitnow:frontend-lead-typescript-berlin-12345" }`_
>
> Good fit: it wants TypeScript, React, Next.js and CI/CD, all strong skills in your profile; the
> only missing one is GraphQL. German is "a plus", not a requirement. One red flag: _"You must be
> based in the EU"_. You're an EU citizen but live outside the EU, so ask whether EU work
> authorization is enough.
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

### Tools

| Tool                | Input                                                               | What it does                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search_jobs`       | `query?`, `tags?`, `remote_scope?`, `posted_within_days?`, `limit?` | Fetches from all sources (cached), normalizes, dedupes, filters, and returns up to `limit` (default 20, max 50) short job summaries, newest first. Includes per-source status and an attribution line. |
| `get_job_details`   | `job_id`                                                            | The full normalized job, description converted to plain text, plus tracker status if saved.                                                                                                            |
| `save_job`          | `job_id`, `notes?`                                                  | Saves the job with status `found`. Saving again keeps the status and appends the note.                                                                                                                 |
| `update_job_status` | `job_id`, `status`, `notes?`                                        | `status` is one of `found`, `applied`, `interview`, `offer`, `rejected`, `skipped`. Every change goes into the status history.                                                                         |
| `list_saved_jobs`   | `status?`                                                           | Saved jobs with status and notes, most recently updated first.                                                                                                                                         |
| `get_profile`       | –                                                                   | Your `profile.json`: skills by level, location, citizenship, languages, what you're looking for, achievement stories (for drafting tailored applications you send yourself).                           |
| `match_job`         | `job_id`                                                            | Matched skills (with your level), missing skills, skill coverage, red flags with evidence, and notes (e.g. "requires EU work authorization: you have it").                                             |

**Red flags `match_job` looks for:** on-site or hybrid; remote region that excludes where you
live (US only, Americas, …); EU or country residence requirements; work authorization you don't
have (EU citizenship counts for the EU and every EU country); required languages you don't speak
(nice-to-haves are reported as notes instead); listings written in another language; employment
types you're not looking for (part-time, internship, …); unpaid or equity-only; US working hours
when you're on European time; more years of experience than your profile has. It's heuristic by
design: every flag carries the sentence it's based on, so you (or Claude) can judge it.

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
  id: "remotive:2091158",        // "<source>:<source id>"; company boards: "greenhouse:gitlab:8860302002"
  source: "remotive" | "arbeitnow" | "remoteok" | "greenhouse" | "lever" | "ashby",
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

This sets up the MCP server for Claude, and everything you need for development. (For the web app
alone, the [Quick start](#quick-start-no-coding-needed) is enough.)

**Requirements:** Node.js 22.12+ and Docker (for Postgres).

```bash
git clone https://github.com/DarioKnezovic/remote-radar-mcp.git
cd remote-radar-mcp
npm install
npm run db:up      # Postgres 18 on localhost:5433 (only Postgres, not the web app)
npm run build
```

If you also run the web app with `docker compose up`, both use the same database and the same
`profile.json`: a job you save in Claude shows up in **My jobs**, and the other way round.

The server runs database migrations automatically when it starts. You can also run them yourself
with `npm run db:migrate`.

**Your profile (for `match_job`):** fill it in on the web app's **My profile** page, or copy
`profile.example.json` to `profile.json` and edit it. `profile.json` is git-ignored and re-read on
every call, so edits apply without a restart.

**Company boards:** `boards.default.json` is a starter list of 21 remote-friendly companies on
Greenhouse, Lever and Ashby. To follow other companies, copy it to `boards.json` (git-ignored) and
edit it; the board token is the company part of the board URL (`job-boards.greenhouse.io/gitlab`,
`jobs.lever.co/jumpcloud`, `jobs.ashbyhq.com/linear`). Lever boards hosted in the EU need
`"region": "eu"`.

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

| Variable       | Default                                                            | Description                                                                                      |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` | `postgres://remote_radar:remote_radar@localhost:5433/remote_radar` | Matches `docker-compose.yml`.                                                                    |
| `LOG_LEVEL`    | `info`                                                             | `debug`, `info`, `warn`, `error`. Logs go to stderr.                                             |
| `CONFIG_DIR`   | the project folder                                                 | Folder with your `profile.json` and `boards.json`. Docker sets it to the mounted project folder. |
| `PROFILE_FILE` | `profile.json` in `CONFIG_DIR`                                     | Path to your profile.                                                                            |
| `BOARDS_FILE`  | `boards.json` in `CONFIG_DIR`, else `boards.default.json`          | Path to the company-boards list.                                                                 |

---

## Architecture

```mermaid
flowchart LR
  claude["Claude Desktop / Claude Code<br/>(MCP client)"]
  browser["Your browser<br/>localhost:3000"]

  subgraph mcp["MCP server (stdio) · src/index.ts"]
    tools["tools/<br/>search_jobs · get_job_details · match_job · get_profile<br/>save_job · update_job_status · list_saved_jobs"]
  end

  subgraph webapp["Web app (Next.js) · web/"]
    pages["pages & server actions<br/>Find jobs · Job page · My jobs · My profile · How it works"]
  end

  subgraph core["Core · createRemoteRadar() in src/app.ts"]
    direction LR
    search["JobSearchService<br/>merge → filter → dedupe → sort → limit"]
    domain["domain/ (pure)<br/>Job · remote scope · filter · dedupe<br/>skills · match"]
    cache["CachedJobSource<br/>TTL · stale-on-error · retry throttle"]
    boardsrc["Job boards<br/>Remotive · Arbeitnow · Remote OK"]
    atssrc["BoardsJobSource ×3<br/>Greenhouse · Lever · Ashby<br/>(one request per company)"]
    repo["JobRepository<br/>(all SQL)"]
    profile["FileProfileStore"]
  end

  db[("PostgreSQL<br/>jobs · saved_jobs<br/>job_status_history · source_fetches")]
  apis["Public job APIs"]
  profilefile[/"profile.json"/]
  boardsfile[/"boards.json"/]

  claude <-->|JSON-RPC over stdio| tools
  browser <-->|HTTP, localhost only| pages
  tools & pages --> search & repo & profile & domain
  search --> domain
  search --> cache
  cache --> boardsrc & atssrc
  cache -->|FetchCacheStore| repo
  boardsrc & atssrc -->|HTTPS, rate-limited by TTL| apis
  profile -->|read per call, write from the form| profilefile
  boardsfile -.->|read at startup| atssrc
  repo --> db
```

Both entry points use the same core, wired once by `createRemoteRadar()`: the same database,
caches, matching and profile. Whatever you do in one shows up in the other.

**One search, step by step**

1. `search_jobs` (or the **Find jobs** page) asks `JobSearchService` for results.
2. Each source is wrapped in `CachedJobSource`. If the last successful fetch, recorded in
   Postgres, is still fresh (Remotive and company boards: 6 h, Remote OK: 2 h, Arbeitnow: 1 h),
   the cached jobs are read from Postgres. Otherwise the source is called once, its jobs are
   upserted, and the fetch is recorded.
3. The source client validates the raw response with zod, one listing at a time, so one bad
   listing doesn't drop the whole feed, and normalizes it into a `Job`. Company-board sources
   fetch their boards four at a time and skip a board that fails (renamed, moved to another ATS).
4. Jobs from all sources are merged, filtered, deduped, sorted and cut to `limit`.
5. A failing source shows up as `ok: false` in the result, and the other sources' jobs are still
   returned. The tool only reports an error if every source fails.

**Project layout**

```
src/
  app.ts              createRemoteRadar(): connects, migrates and wires the core (both entry points)
  index.ts            MCP entry point: createRemoteRadar() + stdio transport
  server.ts           createServer(deps): registers all tools (used directly by tests)
  config.ts           env vars validated with zod, CONFIG_DIR
  domain/             pure logic, no I/O: Job, remote scope, countries, employment, filter,
                      dedupe, text, application status, profile, skills, match
                      (index.ts is published as remote-radar-mcp/domain)
  profile/            reads and writes profile.json
  sources/            JobSource interface, HTTP client, cache, registry, boards config,
                      BoardsJobSource (many company boards on one ATS)
    remotive/         schema (raw API) · normalize · client
    arbeitnow/        schema (raw API) · normalize · client (pagination)
    remoteok/         schema (raw API) · normalize · client
    greenhouse/       schema (raw API) · normalize · client (one request per board)
    lever/            schema (raw API) · normalize · client (global and EU hosts)
    ashby/            schema (raw API) · normalize · client
  services/           JobSearchService
  db/                 pool, migration runner, JobRepository, Postgres cache store
  tools/              one file per MCP tool + shared output schemas
web/                  the web app (Next.js App Router), an npm workspace
  app/                pages, plus actions.ts (server actions: save, status, notes, profile)
  components/         job card, fit panel, status controls, profile form, …
  lib/                radar.ts (loads the core), labels (plain-language text), search, fit cache,
                      sanitize (job descriptions)
migrations/           plain SQL, applied in order
scripts/demo-seed.ts  made-up jobs for a demo database (screenshots, trying the UI)
Dockerfile            the web app image; docker-compose.yml runs it with Postgres
test/
  fixtures/           recorded API responses (trimmed, see test/fixtures/README.md)
  unit/               no network, no database
  integration/        real Postgres, each file in its own temporary schema
```

---

## Development

| Command                       | What it does                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`                 | Run the MCP server from source with tsx                                                |
| `npm run build`               | Compile the core and MCP server to `dist/`                                             |
| `npm run web:dev`             | Build the core, then run the web app with hot reload at `localhost:3000`               |
| `npm run web:build`           | Production build of the core and the web app                                           |
| `npm run app:up` / `app:down` | Build and start / stop the Docker web app and Postgres                                 |
| `npm run demo:seed`           | Fill a database named `*demo*` with made-up jobs (see `scripts/demo-seed.ts`)          |
| `npm test`                    | Unit tests (integration tests skip without a database)                                 |
| `npm run test:db`             | All tests, including Postgres integration tests                                        |
| `npm run test:coverage`       | All tests with a coverage report (`coverage/index.html`)                               |
| `npm run typecheck`           | `tsc --noEmit`                                                                         |
| `npm run lint`                | ESLint (typescript-eslint strict, type-checked); `npm run lint -w web` for the web app |
| `npm run format`              | Prettier                                                                               |
| `npm run db:up` / `db:down`   | Start Postgres only / stop everything                                                  |
| `npm run inspect`             | Build and open the MCP Inspector                                                       |

The web app needs the core built first (`npm run build`), because it imports the compiled
package. `web:dev` and `web:build` do that for you.

**Tests never call the real APIs.** Normalization and dedupe are tested against responses
recorded from every source (`test/fixtures/`). The tool tests connect a real MCP client
to the server over an in-memory transport. Integration tests run the real migrations in a
throwaway Postgres schema.

### Adding a job source

1. Create `src/sources/<name>/` with `schema.ts` (zod schema of the raw API), `normalize.ts`
   (raw → `Job`) and `client.ts` (a class implementing `JobSource`). For an ATS with one board
   per company, build a `BoardsJobSource` from a per-board fetch function instead.
2. Add the id to `SOURCE_IDS` in `src/domain/job.ts`, and to `attributionFor` in
   `src/tools/shared.ts` if the source's terms ask for credit by name.
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
their terms and breaks whenever their HTML changes. Every source here publishes a public API.
Their terms shape the code:

- **Rate limits:** Remotive advises at most 4 requests a day. Arbeitnow asks not to abuse its
  free API. Remote OK and the ATS APIs state no limit, so they're cached for 2–6 hours and
  company boards are fetched a few at a time.
- **Attribution:** every result carries the source name and the original URL. Remote OK
  requires a followed link back to its listing page, so `url` is always the Remote OK URL.
- **Read-only:** Lever's API also accepts applications; that endpoint is never called.
- **No republishing:** the test fixtures are trimmed samples rather than full copies of
  listings, and this README uses made-up listings.

**Why a `JobSource` interface, with caching as a separate wrapper.** Sources are messy in
different ways. Remotive gives free-text locations. Arbeitnow mixes languages in `job_types`,
sometimes reports remote jobs as `remote: false`, and sometimes puts the location in the title.
Greenhouse has no remote flag at all, Lever's `workplaceType` says `"onsite"` where its docs
say `"on-site"`, and Ashby's address sometimes holds a region ("European Union") instead of a
country. Each source keeps that mess in its own folder and outputs the same `Job`, so dedupe,
filters, matching and the tracker are written once. Rate limiting is a separate concern, so
`CachedJobSource` wraps any source instead of each client caching on its own. The v2 sources
were added exactly that way: a folder each, plus a line in the registry.

**Why company boards.** Aggregators like Remotive give few jobs and repost listings late.
Greenhouse, Lever and Ashby host the careers pages of thousands of companies, through public
APIs, so following a company means adding its board token to `boards.json`. When an aggregator
reposts a company's job, dedupe keeps the company's own listing, since that's where you apply.

**Why the cache lives in Postgres.** MCP clients start a new server process for many sessions.
An in-memory cache would refetch on every start, which would quickly break Remotive's 4-per-day
limit. Fetches are recorded in `source_fetches`, and the jobs of the latest fetch are the rows
with `last_seen_at` at or after that fetch. This also means `get_job_details` and `match_job`
work for any job you've seen in a search, not only saved ones. Trade-off: the cache holds
normalized jobs, not raw responses, so a change to a normalizer only shows once that source's
cache expires.

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
Engineer". The copy with more information (salary, known scope, tags; the company's own board
over an aggregator) is kept. A location tacked onto the title ("Staff Engineer | Germany |
Remote") is moved into the location first, so per-country copies match.

Dedupe runs **after** filtering. Companies often post one copy of a role per country ("Remote,
US" and "Remote, Germany"); deduping first could keep the US copy and a Europe search would then
lose the job entirely. Trade-off: copies that all match collapse into one result, so the other
locations aren't listed.

**Why `match_job` is heuristic, and shows its evidence.** Requirements hide in prose ("you must
be based in the EU", "Deutschkenntnisse", "overlap with PST business hours"). Pattern rules
catch most of them cheaply and predictably; each flag carries the sentence it came from, so a
false positive is easy to spot and the model can read the full listing when it matters. The
rules know some important distinctions: EU _work authorization_ is satisfied by any EU
citizenship, but EU _residence_ isn't if you live outside the EU; "German is a plus" is a note,
not a flag; "working across Europe and the US" isn't a timezone requirement.

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

**Why each person runs their own copy, instead of one website.** A shared site would need
accounts, hosting and a privacy policy, but the bigger reason is the sources: their terms are
written for personal use (Arbeitnow: personal, non-commercial; Remotive: at most 4 requests a
day), and a public site would republish their listings to everyone. A local copy fetches for one
person, keeps the profile on that person's computer, and stays within each source's limits. Docker
makes "run your own copy" a single command.

**Why the web app is local-only.** It has no login, so whoever can reach it can read your profile
and change your tracker. Docker publishes it (and Postgres) on `127.0.0.1` only, and `next dev` /
`next start` listen on `127.0.0.1`, so nothing is reachable from your network.

**Why the web app calls the core directly, not through MCP.** MCP is the interface for AI
clients. The web app runs on the same machine as the core, so it calls the same TypeScript
functions (`search`, `matchJob`, the tracker) in-process: no protocol layer, no JSON
round-trips, full types. `createRemoteRadar()` wires the core once for both, so they can't drift
apart.

**Why the core has two entry points.** `remote-radar-mcp/domain` is pure (types, constants,
`matchJob`) and safe to bundle into the web app. `remote-radar-mcp/app` touches the database and
files, and finds its migrations, `profile.json` and boards file relative to its own location;
bundling would break that, so the web app loads it with plain Node at runtime (`web/lib/radar.ts`).
A lint rule stops value imports from `/app` in the web app.

**Why plain language everywhere.** The core speaks in codes (`region_restricted`, `EU only`,
`found`); the web app never shows them. `web/lib/labels.ts` maps each one to words ("May not hire
where you live", "From EU countries", "Saved") with a one-line explanation, and every warning
still shows the listing's own sentence it's based on, so you can judge it yourself.

**Why job descriptions are sanitized.** Descriptions are HTML written by third parties. Before the
job page shows one, `sanitize-html` keeps only basic formatting (paragraphs, lists, headings,
links), drops scripts, styles, images, forms and event handlers, and only allows `http(s)` and
`mailto` links, which open in a new tab.
---

## Sources

| Source                                   | Endpoint                                                                     | Notes                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [Remotive](https://remotive.com)         | `GET https://remotive.com/api/remote-jobs`                                   | Free API returns the latest ~10 jobs, delayed 24 h. Cached 6 h (≤ 4 requests/day). Credit Remotive and link to the listing. |
| [Arbeitnow](https://www.arbeitnow.com)   | `GET https://www.arbeitnow.com/api/job-board-api`                            | 300 jobs/page, mostly Germany/EU, mostly on-site. First 3 pages, cached 1 h. Personal, non-commercial use; link back.       |
| [Remote OK](https://remoteok.com)        | `GET https://remoteok.com/api`                                               | Latest ~100 remote jobs. Cached 2 h. Link back to the Remote OK listing (followed) and name Remote OK; don't use the logo.  |
| [Greenhouse](https://www.greenhouse.com) | `GET boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true`           | Public, no auth. Free-text location only (no remote flag or employment type). Cached 6 h.                                   |
| [Lever](https://www.lever.co)            | `GET api.lever.co/v0/postings/{board}?mode=json` (EU: `api.eu.lever.co`)     | Public, no auth. `workplaceType`, country code, salary range. Cached 6 h.                                                   |
| [Ashby](https://www.ashbyhq.com)         | `GET api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true` | Public, no auth. Unlisted jobs skipped; `publishedAt` is the last publish date. Cached 6 h.                                 |

Job data belongs to these sources and the companies that posted it. This project is for personal
job searching.

## Limitations

- Remotive's free API gives few jobs (about 10). Arbeitnow is mostly German and on-site.
- Many remote jobs say only "Remote" or a city, so they get scope `Unknown`. Include `Unknown` in
  `remote_scope` to see them, and check the listing.
- Salaries are raw text, and Arbeitnow and Greenhouse (in its list API) give none, so there's no salary
  filter yet.
- `match_job` is pattern-based: it catches common phrasings, not every way a requirement can be
  written. Read the evidence and the listing before deciding.
- The web app has no login and is meant for one person on one computer. Don't expose it to a
  network.
- The Docker image is about 650 MB, mostly Next.js and its dependencies.

## Ideas

- Show the other locations of a role that was posted once per country.
- A salary filter, once salaries are parsed into numbers.
- More ATS providers (Workable, SmartRecruiters, Recruitee) through `BoardsJobSource`.
- Drafting a cover letter from the job page (today: ask Claude, which uses your profile's
  achievements).

## License

[MIT](LICENSE) © 2026 Dario Knezović. The license covers this code, not the job listings it
fetches, which belong to their sources.
