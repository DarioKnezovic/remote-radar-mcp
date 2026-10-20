-- Every normalized job fetched from a source. Doubles as the cross-restart cache
-- (see source_fetches) and lets get_job_details work for jobs that aren't saved.
CREATE TABLE jobs (
  id               text PRIMARY KEY,           -- "<source>:<source_job_id>"
  source           text NOT NULL,
  source_job_id    text NOT NULL,
  url              text NOT NULL,
  title            text NOT NULL,
  company          text NOT NULL,
  location         text,
  remote_scope     text NOT NULL,
  employment_type  text NOT NULL,
  salary           text,                       -- raw text; not parsed
  tags             text[] NOT NULL DEFAULT '{}',
  description      text NOT NULL,              -- HTML from the source
  published_at     timestamptz NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_job_id)
);
CREATE INDEX jobs_source_last_seen_idx ON jobs (source, last_seen_at DESC);

-- The user's application tracker.
CREATE TABLE saved_jobs (
  job_id      text PRIMARY KEY REFERENCES jobs (id) ON DELETE RESTRICT,
  status      text NOT NULL DEFAULT 'found'
              CHECK (status IN ('found', 'applied', 'interview', 'offer', 'rejected', 'skipped')),
  notes       text,
  saved_at    timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_jobs_status_idx ON saved_jobs (status, updated_at DESC);

-- Every status change, including the initial save (from_status = NULL).
CREATE TABLE job_status_history (
  id           bigserial PRIMARY KEY,
  job_id       text NOT NULL REFERENCES saved_jobs (job_id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  notes        text,
  changed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_status_history_job_idx ON job_status_history (job_id, changed_at);

-- One row per attempt to fetch a source; used to honour rate limits across restarts.
CREATE TABLE source_fetches (
  id          bigserial PRIMARY KEY,
  source      text NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  ok          boolean NOT NULL,
  job_count   integer,
  error       text
);
CREATE INDEX source_fetches_source_idx ON source_fetches (source, fetched_at DESC);
