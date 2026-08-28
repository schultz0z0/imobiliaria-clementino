SET LOCAL client_min_messages TO warning;

CREATE OR REPLACE FUNCTION prevent_property_public_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'properties.public_id is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_public_id_immutable ON properties;

CREATE TRIGGER properties_public_id_immutable
  BEFORE UPDATE OF public_id ON properties
  FOR EACH ROW EXECUTE FUNCTION prevent_property_public_id_change();

DROP INDEX IF EXISTS publication_jobs_one_active_per_property_idx;
DROP INDEX IF EXISTS publication_jobs_one_active_globally_idx;

WITH ranked_active_jobs AS (
  SELECT
    id,
    row_number() OVER (ORDER BY queued_at, id) AS active_position
  FROM publication_jobs
  WHERE status IN ('queued', 'running')
)
UPDATE publication_jobs AS jobs
SET
  status = 'failed',
  finished_at = now(),
  error_message = 'Superseded by global publication serialization migration'
FROM ranked_active_jobs AS ranked
WHERE jobs.id = ranked.id
  AND ranked.active_position > 1;

CREATE UNIQUE INDEX publication_jobs_one_active_globally_idx
  ON publication_jobs ((true))
  WHERE status IN ('queued', 'running');
