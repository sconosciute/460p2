BEGIN;

TRUNCATE schema_version;
INSERT INTO schema_version VALUES (1, CURRENT_TIMESTAMP);

ALTER TABLE account
    DROP COLUMN IF EXISTS create_date;

COMMIT;