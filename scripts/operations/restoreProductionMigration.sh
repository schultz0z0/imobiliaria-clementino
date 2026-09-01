#!/usr/bin/env sh
set -eu

TERMINAL_ECHO_DISABLED=false
MUTATION_STARTED=false
BACKUP_READY=false
APPLICATION_STOPPED=false
RUNNING_APPLICATION_SERVICES=""

clear_volume() {
  volume="$1"
  docker run --rm -v "$volume:/target" postgres:16-alpine sh -ceu \
    '[ "$PWD" = "/" ]; find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
}

extract_archive() {
  archive_directory="$1"
  archive_name="$2"
  volume="$3"
  docker run --rm -v "$volume:/target" -v "$archive_directory:/bundle:ro" \
    postgres:16-alpine tar -xzf "/bundle/$archive_name" -C /target
}

restore_database_dump() {
  dump="$1"
  docker cp "$dump" "$POSTGRES_CONTAINER:/tmp/state-migration-restore.dump" || return 1
  $COMPOSE exec -T postgres sh -ceu \
    'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --exit-on-error /tmp/state-migration-restore.dump' || return 1
  $COMPOSE exec -T postgres rm -f /tmp/state-migration-restore.dump || return 1
}

restart_previous_services() {
  if [ -n "$RUNNING_APPLICATION_SERVICES" ]; then
    # Intentional word splitting: this is a space-delimited list of known Compose services.
    $COMPOSE up -d $RUNNING_APPLICATION_SERVICES >/dev/null || return 1
  fi
  APPLICATION_STOPPED=false
}

rollback_on_failure() {
  echo "Migration failed after production mutation; restoring rollback backup." >&2
  if (cd "$BACKUP_DIRECTORY" && sha256sum -c SHA256SUMS) &&
    restore_database_dump "$BACKUP_DIRECTORY/database.dump" &&
    clear_volume "$MEDIA_VOLUME" &&
    extract_archive "$BACKUP_DIRECTORY" media.tar.gz "$MEDIA_VOLUME" &&
    clear_volume "$RELEASE_VOLUME" &&
    extract_archive "$BACKUP_DIRECTORY" release.tar.gz "$RELEASE_VOLUME" &&
    restart_previous_services; then
    echo "Automatic rollback completed from $BACKUP_DIRECTORY" >&2
    return 0
  fi
  return 1
}

on_exit() {
  code="$1"
  trap - EXIT
  if [ "$TERMINAL_ECHO_DISABLED" = "true" ]; then
    stty echo 2>/dev/null || true
    printf '\n' >&2
  fi
  unset ADMIN_PASSWORD 2>/dev/null || true
  if [ "$code" -ne 0 ]; then
    set +e
    if [ "$MUTATION_STARTED" = "true" ] && [ "$BACKUP_READY" = "true" ]; then
      rollback_on_failure
      rollback_code="$?"
      if [ "$rollback_code" -ne 0 ]; then
        echo "Automatic rollback failed. Use the verified backup at $BACKUP_DIRECTORY." >&2
      fi
    elif [ "$APPLICATION_STOPPED" = "true" ]; then
      restart_previous_services
    fi
  fi
  exit "$code"
}

trap 'on_exit $?' EXIT
trap 'exit 130' HUP INT TERM

usage() {
  echo "Usage: $0 --bundle /absolute/path/to/bundle --confirm-production" >&2
  exit 2
}

BUNDLE=""
CONFIRM_PRODUCTION="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle) [ "$#" -ge 2 ] || usage; BUNDLE="$2"; shift 2 ;;
    --confirm-production) CONFIRM_PRODUCTION="true"; shift ;;
    *) usage ;;
  esac
done

[ "$CONFIRM_PRODUCTION" = "true" ] || { echo "Refusing production restore without --confirm-production." >&2; exit 2; }
[ -n "$BUNDLE" ] || usage
BUNDLE=$(cd "$BUNDLE" 2>/dev/null && pwd) || { echo "Bundle directory not found." >&2; exit 2; }
[ -f "$BUNDLE/COMPLETE" ] || { echo "Bundle is incomplete: COMPLETE is missing." >&2; exit 2; }
[ -f "$BUNDLE/manifest.json" ] || { echo "Bundle manifest is missing." >&2; exit 2; }
[ -f "$BUNDLE/SHA256SUMS" ] || { echo "Bundle checksums are missing." >&2; exit 2; }
[ -f .env.production ] || { echo ".env.production is missing in the repository root." >&2; exit 2; }

(cd "$BUNDLE" && sha256sum -c SHA256SUMS)

validate_archive_entries() {
  archive_name="$1"
  archive_kind="$2"
  docker run --rm -v "$BUNDLE:/bundle:ro" postgres:16-alpine sh -ceu '
    archive="$1"
    kind="$2"
    if tar -tvzf "$archive" | grep -E -- " -> (/|.*\.\.)"; then
      echo "Unsafe symlink target in $archive" >&2
      exit 22
    fi
    tar -tzf "$archive" | while IFS= read -r entry; do
      case "$entry" in /*|../*|*/../*|*/..) exit 20 ;; esac
      case "$kind:$entry" in
        media:private|media:private/|media:private/*|media:public|media:public/) ;;
        media:public/*) ;;
        release:.|release:./|release:./*) ;;
        *) exit 21 ;;
      esac
    done
  ' sh "/bundle/$archive_name" "$archive_kind"
}

validate_archive_entries media.tar.gz media
validate_archive_entries release.tar.gz release

manifest_count() {
  key="$1"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p" "$BUNDLE/manifest.json" | head -n 1
}

EXPECTED_PROPERTIES=$(manifest_count properties)
EXPECTED_PUBLISHED=$(manifest_count publishedProperties)
EXPECTED_INACTIVE=$(manifest_count inactiveProperties)
EXPECTED_ADMINS=$(manifest_count adminUsers)
EXPECTED_MEDIA_RECORDS=$(manifest_count mediaRecords)
EXPECTED_PRIVATE_FILES=$(manifest_count privateMediaFiles)
EXPECTED_PUBLIC_FILES=$(manifest_count publicMediaFiles)

[ "$EXPECTED_PROPERTIES" = "52" ] || { echo "Unexpected property count in bundle: $EXPECTED_PROPERTIES" >&2; exit 2; }
[ "$EXPECTED_PUBLISHED" = "51" ] || { echo "Unexpected published count in bundle: $EXPECTED_PUBLISHED" >&2; exit 2; }
[ "$EXPECTED_INACTIVE" = "1" ] || { echo "Unexpected inactive count in bundle: $EXPECTED_INACTIVE" >&2; exit 2; }
[ "$EXPECTED_ADMINS" = "1" ] || { echo "Unexpected administrator count in bundle: $EXPECTED_ADMINS" >&2; exit 2; }
[ "$EXPECTED_MEDIA_RECORDS" = "1434" ] || { echo "Unexpected media record count in bundle: $EXPECTED_MEDIA_RECORDS" >&2; exit 2; }

COMPOSE="docker compose --env-file .env.production -f compose.prod.yaml"
$COMPOSE config >/dev/null
$COMPOSE up -d postgres
POSTGRES_CONTAINER=$($COMPOSE ps -q postgres)
[ -n "$POSTGRES_CONTAINER" ] || { echo "PostgreSQL container is unavailable." >&2; exit 1; }

ADMIN_API_CONTAINER=$($COMPOSE ps -a -q admin-api)
WEBSITE_CONTAINER=$($COMPOSE ps -a -q website)
[ -n "$ADMIN_API_CONTAINER" ] || { echo "Admin API container is unavailable; deploy the stack first." >&2; exit 1; }
[ -n "$WEBSITE_CONTAINER" ] || { echo "Website container is unavailable; deploy the stack first." >&2; exit 1; }

MEDIA_VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data/media"}}{{.Name}}{{end}}{{end}}' "$ADMIN_API_CONTAINER")
RELEASE_VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data/published"}}{{.Name}}{{end}}{{end}}' "$WEBSITE_CONTAINER")
[ -n "$MEDIA_VOLUME" ] || { echo "Could not resolve the production media volume." >&2; exit 1; }
[ -n "$RELEASE_VOLUME" ] || { echo "Could not resolve the production release volume." >&2; exit 1; }
docker volume inspect "$MEDIA_VOLUME" "$RELEASE_VOLUME" >/dev/null

BACKUP_ROOT=${MIGRATION_BACKUP_ROOT:-/opt/imobiliaria-clementino-backups}
BACKUP_DIRECTORY="$BACKUP_ROOT/pre-state-migration-$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIRECTORY"
chmod 700 "$BACKUP_DIRECTORY"

echo "Stopping application writers and creating rollback backup at $BACKUP_DIRECTORY"
ACTIVE_SERVICES=$($COMPOSE ps --status running --services)
for service in admin publisher admin-api website; do
  if printf '%s\n' "$ACTIVE_SERVICES" | grep -qx "$service"; then
    RUNNING_APPLICATION_SERVICES="$RUNNING_APPLICATION_SERVICES $service"
  fi
done
$COMPOSE stop admin publisher admin-api website >/dev/null
APPLICATION_STOPPED=true
$COMPOSE exec -T postgres sh -ceu 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl --file=/tmp/pre-state-migration.dump'
docker cp "$POSTGRES_CONTAINER:/tmp/pre-state-migration.dump" "$BACKUP_DIRECTORY/database.dump"
$COMPOSE exec -T postgres rm -f /tmp/pre-state-migration.dump
docker run --rm -v "$MEDIA_VOLUME:/source:ro" -v "$BACKUP_DIRECTORY:/backup" postgres:16-alpine tar -czf /backup/media.tar.gz -C /source .
docker run --rm -v "$RELEASE_VOLUME:/source:ro" -v "$BACKUP_DIRECTORY:/backup" postgres:16-alpine tar -czf /backup/release.tar.gz -C /source .
(cd "$BACKUP_DIRECTORY" && sha256sum database.dump media.tar.gz release.tar.gz > SHA256SUMS)
(cd "$BACKUP_DIRECTORY" && sha256sum -c SHA256SUMS)
BACKUP_READY=true

echo "Restoring PostgreSQL state"
MUTATION_STARTED=true
restore_database_dump "$BUNDLE/database.dump"

echo "Restoring media and published releases into the existing named volumes"
clear_volume "$MEDIA_VOLUME"
extract_archive "$BUNDLE" media.tar.gz "$MEDIA_VOLUME"
clear_volume "$RELEASE_VOLUME"
extract_archive "$BUNDLE" release.tar.gz "$RELEASE_VOLUME"

$COMPOSE exec -T postgres sh -ceu 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE admin_sessions SET revoked_at = COALESCE(revoked_at, clock_timestamp()) WHERE revoked_at IS NULL;"'

ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  [ -t 0 ] || { echo "ADMIN_PASSWORD is required when no interactive terminal is available." >&2; exit 2; }
  printf 'New production administrator password (minimum 12 characters): ' >&2
  TERMINAL_ECHO_DISABLED=true
  stty -echo
  IFS= read -r ADMIN_PASSWORD
  stty echo
  TERMINAL_ECHO_DISABLED=false
  printf '\n' >&2
fi
[ "${#ADMIN_PASSWORD}" -ge 12 ] || { unset ADMIN_PASSWORD; echo "Administrator password must contain at least 12 characters." >&2; exit 2; }

echo "Resetting the imported administrator safely"
ADMIN_USERNAME="$ADMIN_USERNAME" ADMIN_PASSWORD="$ADMIN_PASSWORD" $COMPOSE run --rm --no-deps -T \
  -e ADMIN_USERNAME -e ADMIN_PASSWORD admin-api node --input-type=module <<'NODE'
import argon2 from 'argon2';
import postgres from 'postgres';

const username = process.env.ADMIN_USERNAME?.trim();
const password = process.env.ADMIN_PASSWORD ?? '';
if (!username || password.length < 12 || password.length > 256) process.exit(2);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
  });
  const rows = await sql`
    UPDATE admin_users
    SET username = ${username}, password_hash = ${passwordHash}, must_change_password = true,
        failed_login_count = 0, locked_until = NULL, active = true, updated_at = clock_timestamp()
    RETURNING id
  `;
  if (rows.length !== 1) throw new Error(`Expected one administrator, updated ${rows.length}`);
  await sql`UPDATE admin_sessions SET revoked_at = COALESCE(revoked_at, clock_timestamp()) WHERE revoked_at IS NULL`;
} finally {
  await sql.end({ timeout: 5 });
}
NODE
unset ADMIN_PASSWORD

DB_COUNTS=$($COMPOSE exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "|" -c "SELECT (SELECT count(*) FROM properties),(SELECT count(*) FROM properties WHERE status = '\''published'\''),(SELECT count(*) FROM properties WHERE status = '\''inactive'\''),(SELECT count(*) FROM admin_users),(SELECT count(*) FROM property_media);"')
[ "$DB_COUNTS" = "$EXPECTED_PROPERTIES|$EXPECTED_PUBLISHED|$EXPECTED_INACTIVE|$EXPECTED_ADMINS|$EXPECTED_MEDIA_RECORDS" ] || { echo "Restored database count mismatch: $DB_COUNTS" >&2; exit 1; }

PRIVATE_FILES=$(docker run --rm -v "$MEDIA_VOLUME:/source:ro" postgres:16-alpine sh -c 'find /source/private -type f | wc -l')
PUBLIC_FILES=$(docker run --rm -v "$MEDIA_VOLUME:/source:ro" postgres:16-alpine sh -c 'find /source/public -type f | wc -l')
[ "$PRIVATE_FILES" = "$EXPECTED_PRIVATE_FILES" ] || { echo "Private media count mismatch: $PRIVATE_FILES" >&2; exit 1; }
[ "$PUBLIC_FILES" = "$EXPECTED_PUBLIC_FILES" ] || { echo "Public media count mismatch: $PUBLIC_FILES" >&2; exit 1; }

echo "Queueing a complete public release rebuild"
$COMPOSE exec -T postgres sh -ceu 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
UPDATE publication_jobs
SET status = '\''failed'\'', finished_at = clock_timestamp(), error_message = '\''Superseded by production state migration'\''
WHERE status IN ('\''queued'\'', '\''running'\'');
INSERT INTO publication_jobs (property_id, revision_id, requested_by)
SELECT property.id, property.published_revision_id, administrator.id
FROM properties AS property
CROSS JOIN admin_users AS administrator
WHERE property.status = '\''published'\'' AND property.published_revision_id IS NOT NULL
ORDER BY property.updated_at DESC
LIMIT 1;
SQL'

$COMPOSE up -d publisher
attempt=0
while [ "$attempt" -lt 90 ]; do
  JOB_STATUS=$($COMPOSE exec -T postgres sh -ceu 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT status FROM publication_jobs ORDER BY id DESC LIMIT 1;"')
  [ "$JOB_STATUS" = "succeeded" ] && break
  [ "$JOB_STATUS" = "failed" ] && { echo "Release rebuild failed." >&2; exit 1; }
  attempt=$((attempt + 1))
  sleep 2
done
[ "${JOB_STATUS:-}" = "succeeded" ] || { echo "Release rebuild timed out." >&2; exit 1; }

docker run --rm -v "$RELEASE_VOLUME:/target:ro" postgres:16-alpine sh -ceu 'test -e /target/current/release-manifest.json'
$COMPOSE up -d admin-api admin website publisher
APPLICATION_STOPPED=false
MUTATION_STARTED=false
$COMPOSE ps -a

echo "Production state migration completed successfully."
echo "Rollback backup: $BACKUP_DIRECTORY"
echo "Database counts: $DB_COUNTS; media files: private=$PRIVATE_FILES public=$PUBLIC_FILES"
