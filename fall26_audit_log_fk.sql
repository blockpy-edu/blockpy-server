-- Audit logging, phase 3: let audit rows outlive the rows they describe.
--
-- Run by hand against production Postgres (the project does not run Alembic there).
-- See docs/specs/audit-logging-review.md, sections 3 and 5, for the reasoning.
--
-- course_log DELETE and role_log REMOVED events point at rows that are being deleted
-- in the same request, and assignment_log rows already point at assignments that
-- Assignment.remove deletes. The foreign keys from the log tables to course, role and
-- assignment are therefore dropped. Indexes on those columns stay, and the references
-- to "user" (subject_id, authorizer_id) stay because users are not deleted.
--
-- Constraint names below are Postgres defaults for unnamed inline FOREIGN KEY clauses
-- (<table>_<column>_fkey). Confirm before running with:
--     \d role_log
--     \d course_log
--     \d assignment_log
-- or with the SELECT at the bottom of this file.
--
-- Deploy order: run this BEFORE deploying the phase 2 code that writes DELETE and
-- REMOVED rows; every other new write is safe against the current constraints.

BEGIN;

ALTER TABLE role_log        DROP CONSTRAINT IF EXISTS role_log_role_id_fkey;
ALTER TABLE role_log        DROP CONSTRAINT IF EXISTS role_log_course_id_fkey;
ALTER TABLE course_log      DROP CONSTRAINT IF EXISTS course_log_course_id_fkey;
ALTER TABLE assignment_log  DROP CONSTRAINT IF EXISTS assignment_log_assignment_id_fkey;
ALTER TABLE assignment_log  DROP CONSTRAINT IF EXISTS assignment_log_course_id_fkey;

-- The audit feed (phase 6) sorts each table by date_created. assignment_log is the
-- only one that grows with routine editing, so give it an index for that sort.
CREATE INDEX IF NOT EXISTS assignment_log_date_index ON assignment_log (date_created);

COMMIT;

-- Verification: only the subject_id / authorizer_id references to "user" should remain.
SELECT conrelid::regclass AS "table", conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text IN ('role_log', 'course_log', 'assignment_log')
ORDER BY 1, 2;
