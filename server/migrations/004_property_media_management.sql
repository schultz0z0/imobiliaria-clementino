ALTER TABLE property_media
  ADD COLUMN alt_text text NOT NULL DEFAULT 'Foto do imóvel',
  ADD COLUMN position integer NOT NULL DEFAULT 0,
  ADD COLUMN cover_storage_key text,
  ADD COLUMN gallery_storage_key text,
  ADD COLUMN thumb_storage_key text,
  ADD COLUMN uploaded_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN removed_at timestamptz,
  ADD COLUMN gc_eligible_at timestamptz,
  ADD COLUMN retained_for_publication boolean NOT NULL DEFAULT false;

-- Legacy rows may predate ordering and can contain the same bytes more than
-- once. Canonicalize every revision snapshot before the active-content unique
-- index is introduced, retaining the first media UUID for each checksum.
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

-- This one-time data migration rewrites immutable snapshots only to replace
-- duplicate IDs with the canonical media ID. Keep the normal append-only
-- protection in force before and after this transactional upgrade.
ALTER TABLE property_revisions DISABLE TRIGGER property_revisions_append_only;

DO $$
DECLARE duplicate_group record;
DECLARE duplicate_media record;
BEGIN
  FOR duplicate_group IN
    SELECT property_id, checksum_sha256, min(id::text)::uuid AS canonical_id, array_agg(id) AS media_ids
    FROM property_media
    GROUP BY property_id, checksum_sha256
    HAVING count(*) > 1
  LOOP
    FOR duplicate_media IN
      SELECT unnest(duplicate_group.media_ids) AS media_id, duplicate_group.canonical_id AS canonical_id
    LOOP
      IF duplicate_media.media_id <> duplicate_media.canonical_id THEN
        UPDATE property_revisions
        SET payload = canonicalize_property_media_payload(
          payload, duplicate_media.media_id::text, duplicate_media.canonical_id::text
        )
        WHERE property_id = (
          SELECT property_id FROM property_media WHERE id = duplicate_media.media_id
        );
        UPDATE property_media
        SET removed_at = clock_timestamp(),
            retained_for_publication = false,
            gc_eligible_at = clock_timestamp()
        WHERE id = duplicate_media.media_id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE property_revisions ENABLE TRIGGER property_revisions_append_only;

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

ALTER TABLE property_media
  ADD CONSTRAINT property_media_alt_text_not_blank CHECK (btrim(alt_text) <> ''),
  ADD CONSTRAINT property_media_alt_text_bounded CHECK (char_length(alt_text) <= 180),
  ADD CONSTRAINT property_media_position_nonnegative CHECK (position >= 0),
  ADD CONSTRAINT property_media_cover_storage_key_not_blank
    CHECK (cover_storage_key IS NULL OR btrim(cover_storage_key) <> ''),
  ADD CONSTRAINT property_media_gallery_storage_key_not_blank
    CHECK (gallery_storage_key IS NULL OR btrim(gallery_storage_key) <> ''),
  ADD CONSTRAINT property_media_thumb_storage_key_not_blank
    CHECK (thumb_storage_key IS NULL OR btrim(thumb_storage_key) <> ''),
  ADD CONSTRAINT property_media_gc_state_consistency CHECK (
    (removed_at IS NULL AND gc_eligible_at IS NULL AND retained_for_publication = false)
    OR
    (removed_at IS NOT NULL AND (
      (retained_for_publication = true AND gc_eligible_at IS NULL)
      OR (retained_for_publication = false AND gc_eligible_at IS NOT NULL)
    ))
  );

CREATE UNIQUE INDEX property_media_active_content_unique_idx
  ON property_media (property_id, checksum_sha256)
  WHERE removed_at IS NULL;

CREATE INDEX property_media_active_order_idx
  ON property_media (property_id, position, id)
  WHERE removed_at IS NULL;

CREATE INDEX property_media_deferred_gc_idx
  ON property_media (gc_eligible_at, id)
  WHERE removed_at IS NOT NULL AND retained_for_publication = false;
