# Audit logs

BlockPy keeps four active audit tables plus two for server errors. This page says what
each one records, the `field`/`value` conventions, where to review them, and what has to
happen in production. The design history is in `docs/specs/audit-logging-review.md`.

## Tables

| Table | One row per | Written from |
|---|---|---|
| `course_log` | change to a course, or a course-level event | `models/course.py`, `controllers/endpoints/courses.py`, the fork endpoints, `controllers/admin.py`, `scripts/db_commands.py` |
| `role_log` | role given, removed or changed in a course | `models/role.py`, `models/user.py` (LTI role sync) |
| `assignment_log` | change to an assignment | `controllers/endpoints/assignments.py`, `assignment_groups.py`, `blockpy.py` |
| `submission_log` | student or grader activity on a submission | many places; not an audit table, and its foreign keys stay |
| `access_log` + `error_log` | unhandled server error (one `access_log` row per failure, not per request) | `controllers/errors.py` |

Every row carries `subject_id` (who acted), `date_created`, and the client's own
`client_timestamp`/`client_timezone` when the request supplied them. `role_log` also has
`authorizer_id`: who gave or removed the role. When a user changes their own roles (an
LTI launch), the authorizer is the user.

Roles without a course (the global `admin` role) are not logged, because
`role_log.course_id` is `NOT NULL`.

## Events and the `field` / `value` conventions

### `course_log`

| `event_type` | `field` | `value` |
|---|---|---|
| `create` | | |
| `delete` | | (written before the row is deleted; the CLI attributes it to user 1). Deleting a course removes its roles, invites, tags, groups, memberships and assignments; from the web it is refused when any student work exists (archive instead), and the CLI needs `--remove-linked` to destroy work |
| `rename` | | the new name |
| `edit` | the changed column: `name`, `url`, `visibility`, `term`, `settings`, `endpoint`, `locked` | the new value; for `settings`, a JSON object with the one key that changed |
| `transfer` | | the new owner's id (Flask-Admin only) |
| `transfer` | `assignment_group_id` | JSON `{assignment_group_id, other_course_id, submissions}` for a bulk submission transfer; one row on each course |
| `corrupted` | `settings` | the unparseable settings text that was reset |
| `adopt` / `unadopt` | `assignment_id` | the assignment's id |
| `fork` | `assignment_id` or `assignment_group_id` | the id of the *new* copy; the row is on the course that received it |

`archive` is defined but unused: archiving is `edit` with `field="visibility"`,
`value="archived"`.

### `role_log`

`event_value` holds the role name: the new name for `given` and `changed`, the old name
for `removed`.

### `assignment_log`

| `event_type` | `field` | `value` |
|---|---|---|
| `create` | | |
| `archive` | | the default for removing an assignment: status set to `archived`, taken out of its groups, submissions kept |
| `delete` | | only with `hard_delete=true`; written before the delete, which also removes every course's submissions |
| `edit` | `assignment_settings.blockpy` | JSON of the settings that were submitted |
| `edit` | an instructor file name | the whole file |
| `edit` | `course_id` | the new course id (moved between courses); the row's own `course_id` is the old course |
| `fork` | `forked_id` | the source assignment's id; the row is on the new assignment |
| `rename` | the old file name | the new file name |

`assignment_log.course_id` is the course the editor was opened in, which is not always
the assignment's owning course.

### `submission_log`

`event_type` is free text. Everything the server writes is a member of
`SubmissionLogEvent` in `models/enums/logs.py`; the client may send other values through
`blockpy.log_event`.

## Foreign keys

`course_log.course_id`, `role_log.role_id`, `role_log.course_id`,
`assignment_log.assignment_id` and `assignment_log.course_id` have **no** database
foreign key, so `delete`/`removed` rows can outlive what they describe. The models join
those relationships explicitly and use `passive_deletes`, so an ORM delete never nulls
them out. The references to `user` stay, because users are only deleted by the
anonymous-user cleanup, which deletes their log rows first.

Production was created with hand-run SQL, not Alembic. `fall26_audit_log_fk.sql`
(UTF-8, next to `sum25_upgrade_sql.sql`) drops those five constraints and adds an
index on `assignment_log.date_created`. **Run it before deploying this code**: until
then, deleting a course or removing a role fails on the constraint.

The test suite enforces foreign keys in SQLite by default (`BLOCKPY_TEST_FOREIGN_KEYS=0`
turns it off), so a delete that would orphan rows fails in tests the way it would in
production.

## Reviewing

Admin pages, linked from the "Audit" entry in the navigation bar:

| Page | Shows |
|---|---|
| `/audit/` | Events per table in the last day and week, recent destructive events, recent instructor/admin grants, and a search box that jumps to a user, course or assignment |
| `/audit/events` | The whole feed with every filter |
| `/audit/user/<id>` | What the user did, and the roles they received |
| `/audit/errors` | `error_log` grouped by exception type and innermost frame, with recent occurrences |

Instructor pages, open to instructors of the owning course (adopting an assignment from
another course does not grant access to its history):

| Page | Shows |
|---|---|
| `/audit/course/<id>` | Everything about one course, with Settings / Roster / Assignments tabs. Linked as "Course History" in the course's instructor tools |
| `/audit/assignment/<id>` | Every edit of one assignment; each settings or file edit can be diffed against the previous one. Linked as "History" in the assignment manager's menu |

The JSON behind the pages lives under the same prefix: `/audit/feed`,
`/audit/event/<table>/<id>`, `/audit/diff/assignment_log/<id>`, `/audit/summary`,
`/audit/error_groups`, `/audit/lookup`. Non-admin feed requests are scoped server-side
to the course or assignment they name. Values longer than 500 characters are truncated
in the feed and returned whole by the event endpoint.

Raw rows are also listed under the "Logs" category of the Flask-Admin panel, read-only.

## Errors

`record_error` in `controllers/errors.py` runs for unhandled exceptions and LTI failures.
It rolls the session back, writes the `access_log` row, then the `error_log` row, and
swallows any failure of its own. Errors returned as `success=False` JSON, and errors
inside huey tasks, are not recorded.

Tracebacks can contain student code, emails and LTI parameters, so `dump_db` leaves
both tables out. Prune by hand or from cron:

```
python manage.py prune_error_logs --days 90
```

## Deviations from the spec

- The HTML feed page is `/audit/events`, because the spec used `/audit/feed` for both
  the page and the JSON endpoint.
- Bulk transfer rows store a JSON value with the group id, the other course and the
  submission count, rather than the bare count.
- Sparklines are inline SVG rather than Chart.js.
- The editor's settings panel belongs to the BlockPy client repository, so the
  assignment "History" link is in the assignment manager instead.
- The `assignment_log.date_created` index is created by the SQL script unconditionally
  rather than only if the feed turns out to be slow.
