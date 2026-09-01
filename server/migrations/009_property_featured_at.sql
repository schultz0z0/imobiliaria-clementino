ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS featured_at timestamptz;

CREATE INDEX IF NOT EXISTS properties_featured_at_idx
  ON properties (featured_at DESC, id DESC)
  WHERE featured_at IS NOT NULL AND status = 'published';

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS title_key text;

UPDATE properties AS p
SET title_key = regexp_replace(
  regexp_replace(
    lower(translate(btrim(revision.payload #>> '{editorial,title}'),
      'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g'
  ),
  '(^-|-$)', '', 'g'
)
FROM property_revisions AS revision
WHERE revision.id = p.draft_revision_id
  AND p.title_key IS NULL
  AND nullif(btrim(revision.payload #>> '{editorial,title}'), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS properties_title_key_unique_idx
  ON properties (title_key)
  WHERE title_key IS NOT NULL;
