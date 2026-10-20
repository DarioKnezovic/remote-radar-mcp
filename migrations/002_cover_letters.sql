-- Your own cover letter drafts, one per job, edited on the job page. Never sent anywhere.
CREATE TABLE cover_letters (
  job_id      text PRIMARY KEY REFERENCES jobs (id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
