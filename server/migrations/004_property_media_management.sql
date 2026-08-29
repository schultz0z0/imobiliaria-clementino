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
