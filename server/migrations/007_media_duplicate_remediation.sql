-- Repair installations that recorded the original 004/005 before duplicate
-- payload canonicalization existed. The work is intentionally idempotent: a
-- later run finds no active duplicate checksums and recreates the same index.
CREATE OR REPLACE FUNCTION canonicalize_property_media_payload(
  input_payload jsonb,
  old_photo_id text,
  canonical_photo_id text
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE media jsonb := COALESCE(input_payload->'media', '{}'::jsonb);
DECLARE ordered jsonb;
DECLARE alt jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(photo_id) ORDER BY first_position), '[]'::jsonb)
  INTO ordered
  FROM (
    SELECT CASE WHEN value = old_photo_id THEN canonical_photo_id ELSE value END AS photo_id,
           min(ordinality) AS first_position
    FROM jsonb_array_elements_text(COALESCE(media->'orderedPhotoIds', '[]'::jsonb))
      WITH ORDINALITY AS ids(value, ordinality)
    GROUP BY CASE WHEN value = old_photo_id THEN canonical_photo_id ELSE value END
  ) AS normalized;
  media := jsonb_set(media, '{orderedPhotoIds}', ordered, true);
  IF media->>'coverPhotoId' = old_photo_id THEN
    media := jsonb_set(media, '{coverPhotoId}', to_jsonb(canonical_photo_id), true);
  END IF;
  IF jsonb_typeof(media->'altTextByPhotoId') = 'object' THEN
    alt := media->'altTextByPhotoId';
    alt := jsonb_set(
      alt - old_photo_id,
      ARRAY[canonical_photo_id],
      COALESCE(alt->canonical_photo_id, alt->old_photo_id),
      true
    );
    media := jsonb_set(media, '{altTextByPhotoId}', alt, true);
  END IF;
  RETURN jsonb_set(input_payload, '{media}', media, true);
END;
$$;

ALTER TABLE release_media_refs
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT clock_timestamp();

CREATE TEMP TABLE media_duplicate_remap (
  duplicate_id uuid PRIMARY KEY,
  canonical_id uuid NOT NULL,
  property_id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE media_duplicate_release_refs (
  release_id bigint NOT NULL,
  canonical_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (release_id, canonical_id)
) ON COMMIT DROP;

INSERT INTO media_duplicate_remap (duplicate_id, canonical_id, property_id)
SELECT media.id, duplicates.canonical_id, media.property_id
FROM property_media AS media
JOIN (
  SELECT property_id, checksum_sha256, min(id::text)::uuid AS canonical_id
  FROM property_media
  WHERE removed_at IS NULL
  GROUP BY property_id, checksum_sha256
  HAVING count(*) > 1
) AS duplicates
  ON duplicates.property_id = media.property_id
 AND duplicates.checksum_sha256 = media.checksum_sha256
WHERE media.id <> duplicates.canonical_id AND media.removed_at IS NULL;

-- A release can point at multiple duplicate rows without already pointing at
-- the canonical row. Materialize the desired canonical references first so
-- that remapping never transiently violates (release_id, media_id).
INSERT INTO media_duplicate_release_refs (release_id, canonical_id, created_at)
SELECT ref.release_id, remap.canonical_id, min(ref.created_at)
FROM release_media_refs AS ref
JOIN media_duplicate_remap AS remap ON remap.duplicate_id = ref.media_id
GROUP BY ref.release_id, remap.canonical_id;

-- This predicate only removes references to duplicate IDs in this migration's
-- mapping; unrelated release media remains untouched.
DELETE FROM release_media_refs AS ref
USING media_duplicate_remap AS remap
WHERE ref.media_id = remap.duplicate_id;

-- Existing canonical references and every duplicate source converge here.
-- The oldest source timestamp remains the canonical reference timestamp.
INSERT INTO release_media_refs AS canonical_ref (release_id, media_id, created_at)
SELECT release_id, canonical_id, created_at
FROM media_duplicate_release_refs
ON CONFLICT (release_id, media_id) DO UPDATE
SET created_at = LEAST(canonical_ref.created_at, EXCLUDED.created_at);

DROP INDEX IF EXISTS property_media_active_content_unique_idx;
ALTER TABLE property_revisions DISABLE TRIGGER property_revisions_append_only;

DO $$
DECLARE duplicate_media record;
BEGIN
  FOR duplicate_media IN
    SELECT duplicate_id, canonical_id, property_id FROM media_duplicate_remap
  LOOP
    UPDATE property_revisions
    SET payload = canonicalize_property_media_payload(
      payload, duplicate_media.duplicate_id::text, duplicate_media.canonical_id::text
    )
    WHERE property_id = duplicate_media.property_id;
    -- The constraint requires a valid deferred-GC state immediately; the
    -- property-level refresh below is authoritative for the final outcome.
    UPDATE property_media
    SET removed_at = clock_timestamp(),
        retained_for_publication = false,
        gc_eligible_at = clock_timestamp() + interval '30 days'
    WHERE id = duplicate_media.duplicate_id AND removed_at IS NULL;
  END LOOP;
END;
$$;

ALTER TABLE property_revisions ENABLE TRIGGER property_revisions_append_only;

DO $$
DECLARE affected_property record;
BEGIN
  FOR affected_property IN SELECT DISTINCT property_id FROM media_duplicate_remap LOOP
    PERFORM refresh_property_media_gc(affected_property.property_id);
  END LOOP;
END;
$$;

WITH latest_payload_position AS (
  SELECT media.id,
         (
           SELECT ids.ordinality - 1
           FROM property_revisions revision,
                jsonb_array_elements_text(
                  COALESCE(revision.payload #> '{media,orderedPhotoIds}', '[]'::jsonb)
                ) WITH ORDINALITY AS ids(photo_id, ordinality)
           WHERE revision.property_id = media.property_id AND ids.photo_id = media.id::text
           ORDER BY revision.revision_number DESC
           LIMIT 1
         ) AS position
  FROM property_media AS media
  WHERE media.removed_at IS NULL
), fallback_position AS (
  SELECT id, row_number() OVER (PARTITION BY property_id ORDER BY created_at, id) - 1 AS position
  FROM property_media WHERE removed_at IS NULL
)
UPDATE property_media AS media
SET position = COALESCE(latest_payload_position.position, fallback_position.position)
FROM latest_payload_position
JOIN fallback_position USING (id)
WHERE media.id = latest_payload_position.id;

CREATE UNIQUE INDEX property_media_active_content_unique_idx
  ON property_media (property_id, checksum_sha256)
  WHERE removed_at IS NULL;
