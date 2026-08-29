-- 005 refreshes retention when a release expires, but deleting a release also
-- removes the final immutable reference and must make deferred media eligible.
CREATE OR REPLACE FUNCTION refresh_property_media_gc_from_release()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE property_uuid uuid;
DECLARE job_id bigint;
BEGIN
  job_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.publication_job_id ELSE NEW.publication_job_id END;
  SELECT property_id INTO property_uuid FROM publication_jobs WHERE id = job_id;
  IF property_uuid IS NOT NULL THEN
    PERFORM refresh_property_media_gc(property_uuid);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_releases_media_gc_delete ON site_releases;
CREATE TRIGGER site_releases_media_gc_delete
AFTER DELETE ON site_releases
FOR EACH ROW EXECUTE FUNCTION refresh_property_media_gc_from_release();
