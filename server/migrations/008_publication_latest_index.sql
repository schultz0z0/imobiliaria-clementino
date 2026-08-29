CREATE INDEX IF NOT EXISTS publication_jobs_latest_idx
  ON publication_jobs (queued_at DESC, id DESC);
