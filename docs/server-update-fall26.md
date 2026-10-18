# Server update guide, fall 2026

This is the operator's checklist for deploying the `unify-security-audit` branch, which merges
`audit-logging` (audit tables, review pages, error recording) with `security-uploads-similarity`
(uploads and reports moved out of `static/`, authorization fixes, course-creation limits).

Everything below assumes the Docker Compose deployment (`web`, `huey`, `db`, `redis`, `nginx`).
Commands are run from the checkout on the server. Steps are in the order they must happen; the
reasons are in the notes under each step.

## Summary of what changes

| Area            | Change                                                                                             | Action needed on the server                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Database schema | Five foreign keys dropped from the log tables, one index added                                     | Run `fall26_audit_log_fk.sql` by hand **before** the new code starts                        |
| Filesystem      | Uploads and reports move from `static/uploads`, `static/reports` to `data/uploads`, `data/reports` | New `data_volume`; copy the old files across once                                           |
| nginx           | Only TLS 1.2 and 1.3 are offered                                                                   | Recreate the nginx container so the template is re-rendered                                 |
| Config          | New defaults: 1-day JWT lifetime, 14-day remember cookie, course-creation limits                   | Nothing required; override in `instance/configuration.py` only if you want different values |
| Scheduled work  | `error_log` grows with every unhandled error                                                       | Add a cron entry for `manage.py prune_error_logs`                                           |
| WSGI server     | gunicorn worker timeout raised from 30 s to 120 s; uWSGI packages, template and socket volume removed | `docker compose build web huey` (the entrypoint is baked into the image), then `up -d`     |
| Grade passback  | Posts to Canvas time out after `LTI_POST_TIMEOUT` (60 s) and failed posts are retried from the `huey` worker | Nothing required; keep the `huey` container running, it now does real work for grades |

There are no new tables or columns. Every enum value the new code writes fits the existing
`VARCHAR` columns created by `sum25_upgrade_sql.sql`.

## 1. Back up the database

```bash
docker compose exec -T db pg_dump -U blockpy -d blockpy -Fc > backups/blockpy-$(date +%F).dump
```

Use the user and database names from your `.env.db`. The SQL in step 2 is reversible in
principle (the constraints can be re-added), but a dump is cheaper than finding out.

## 2. Run the audit-log SQL (before deploying the code)

```bash
docker compose exec -T db psql -U blockpy -d blockpy -v ON_ERROR_STOP=1 < fall26_audit_log_fk.sql
```

The script runs in one transaction and ends with a `SELECT` that lists the foreign keys left on
`role_log`, `course_log` and `assignment_log`. Only the references to `"user"` (`subject_id`,
`authorizer_id`) should remain. If the output still lists `course_id`, `role_id` or
`assignment_id` constraints, the production names differ from the Postgres defaults the script
assumes; find them with `\d role_log` and so on, and drop them by name.

Why first: the new code writes a `course_log` `delete` row and a `role_log` `removed` row in the
same request that deletes the course or role. With the constraints in place, deleting a course or
removing someone from a course fails with an integrity error. The old code never writes those
rows, so running the SQL ahead of time is harmless.

## 3. Deploy the code

```bash
git fetch
git checkout unify-security-audit      # or master, once merged
git pull
docker compose build web huey
docker compose up -d
```

`up -d` creates the new `data_volume`, mounts it at `/usr/src/app/data` in both `web` and
`huey`, and the entrypoint creates `data/uploads`, `data/uploads/submission_blocks` and
`data/reports` inside it. The `nginx` container is recreated because its command re-renders the
template; confirm the TLS change with:

```bash
docker compose exec nginx nginx -T | grep ssl_protocols
```

The frontend bundle (`static/libs/blockpy_server/frontend.js`) is committed, so no webpack build
is needed on the server.

The `web` image must be rebuilt, not just restarted: `conf/entrypoint.sh` is copied into the image
at build time, and it now starts gunicorn with `--timeout 120 --graceful-timeout 30`. Confirm with:

```bash
docker compose exec web ps -o args= -C gunicorn | head -1
```

The `uwsgi_socket` volume is no longer declared. `up -d` recreates `web` and `nginx` without the
mount; the old volume stays on disk until you remove it:

```bash
docker volume rm blockpy-server_uwsgi_socket   # name may differ; see `docker volume ls`
```

## 4. Copy uploads and reports into the new folder

The old folders still exist inside `static_volume`, so the copy can happen from inside the
container after the new code is up:

```bash
docker compose exec web sh -c '
  cp -a static/uploads/.  data/uploads/  &&
  cp -a static/reports/.  data/reports/  &&
  du -sh static/uploads data/uploads static/reports data/reports'
```

Check that the two `du` lines for each pair match. Then verify in the browser:

- open an assignment that uses an uploaded image or data file, and download a file through
  the editor (`blockpy/download_file`); it should arrive as an attachment;
- run a similarity report from a course you grade and open it from the task status page.

Leave the old `static/uploads` and `static/reports` in place for a week or two. Anything under
`static/` is still served by Flask without any checks, so once you are confident nothing is
missing, delete them:

```bash
docker compose exec web sh -c 'rm -rf static/uploads static/reports'
```

Worth doing at the same time: search the nginx access logs for `/static/uploads` and
`/static/reports` hits from before the deploy, to see whether the old open paths were being
used by anyone other than the app.

## 5. Check the audit pages

Log in as an admin and open:

- `/audit/` (dashboard: events per table, recent destructive events, recent grants, lookup box);
- `/audit/events` (the full feed), `/audit/errors` (grouped `error_log`);
- a course's "Course History" link from its instructor tools, and an assignment's "History"
  entry in the assignment manager menu.

Make one harmless change (rename a course and rename it back) and confirm two `course_log`
rows appear in the feed. The raw tables are also listed under "Logs" in the Flask-Admin panel.

## 5b. Check grade passback

Grade posts to Canvas are the most important code path in the system and this deploy changes
how they fail. From a Canvas launch, run an assignment to a passing state and confirm the grade
reaches the gradebook; the submission's history (assignment manager → History) should show one
`X-Submission.LMS` row and no `X-Submission.LMS.Failure` rows.

Failed posts are now retried three times, fifteen seconds apart, by the `huey` worker. Each
retry chain is one row in `report` with `task = 'queue_lti_post_grade'`; a chain that is still
`started` or `error` an hour later means the LMS kept refusing, and the submission stays
`Failed` for the instructor's failed-grades page. Before this deploy that task crashed on its
first attempt every time, so any old rows in `started` state are from the old code and can be
ignored or deleted:

```sql
SELECT status, COUNT(*) FROM report WHERE task = 'queue_lti_post_grade' GROUP BY status;
```

## 6. Schedule error-log pruning

`error_log` keeps full tracebacks, which can contain student code, emails and LTI parameters.
`dump_db` already leaves `access_log` and `error_log` out. Prune on a schedule, for example in
the host's crontab:

```
15 4 * * 0  cd /path/to/blockpy-server && docker compose exec -T web python manage.py prune_error_logs --days 90
```

## 7. Configuration you may want to adjust

None of these need a change for the deploy to work. The defaults live in `config.py`; override
in `instance/configuration.py`.

| Key                                            | Default                              | Meaning                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_TOKEN_EXPIRES`                     | 1 day (was 30)                       | Lifetime of the token embedded in editor pages for LTI iframes. A fresh LTI launch mints a new one; tokens issued before the deploy stay valid until their own expiry |
| `REMEMBER_COOKIE_DURATION`                     | 14 days (was Flask-Login's one year) | Remember-me cookie set by LTI and JWT logins                                                                                                                          |
| `COURSE_CREATION_NEW_ACCOUNT_HOURS` / `_LIMIT` | 24 / 1                               | Accounts younger than this may own at most this many courses                                                                                                          |
| `COURSE_CREATION_DAILY_LIMIT`                  | 5                                    | Courses any non-exempt account may create per rolling day                                                                                                             |
| `COURSE_CREATION_PUBLIC_AFTER_DAYS`            | 7                                    | Younger, unconfirmed accounts have `public` downgraded to `private` with a flash message                                                                              |
| `PREFERRED_LOGIN_URL`                          | `None`                               | Where anonymous users are redirected by `login_required`. Replaces the old `PREFERRED_LOGIN` key; set it if your instance config used the old name                    |
| `LTI_POST_TIMEOUT`                             | 60 seconds                           | Socket timeout for each grade post to Canvas (previously unlimited). Keep it below gunicorn's `--timeout` in `conf/entrypoint.sh` (120 s), or the worker is killed before the failure is recorded |

Admins and anyone holding a grading role in an LMS-linked course are exempt from the
course-creation limits. Set a limit to `0` to disable that rule.

## 8. Behaviour changes to tell instructors about

- **Removing an assignment archives it.** The assignment manager's remove action now sets the
  status to `archived`, takes the assignment out of its groups and keeps every submission.
  Only an explicit `hard_delete=true` request performs the old full delete, which also removes
  every course's submissions for it. Both are recorded in `assignment_log`.
- **Deleting a course is refused when student work exists.** Archive it instead. The CLI
  `manage.py delete_course --course ID` needs `--remove-linked` to destroy work.
- **Anonymous visitors are redirected to log in** on every route that used `login_required`;
  the try-it-out editor routes still accept them.
- **Duplicate assignment and group URLs are rejected** at save time. Nothing enforces this in
  the database yet; see the follow-ups.
- **Similarity reports only cover courses the requester grades**, and downloads always arrive
  as attachments.
- **The submission table offers only "Regrade as human".** The old autograder "Regrade" button
  (and its bulk variant) never sent anything to Canvas. The human regrade re-sends the grade
  from the instructor's account and marks the submission fully graded. The quiz report page
  keeps its own regrade button, which does re-grade the quiz server-side.
- **Failed grade posts are retried automatically.** When Canvas cannot be reached or rejects a
  grade, the submission is marked `Failed` as before, and the worker retries three times over
  the next minute. A successful retry puts the grading status back to what it was before the
  failure, so the submission leaves the failed-grades page on its own.
- **Deleting a template course detaches its exam groups** from other courses' submissions
  instead of failing with a database error. The audit row is written only after the delete
  succeeds.
- **LTI roles BlockPy does not know (Observer, SysAdmin, ...) are ignored** on launch instead
  of being stored; storing one used to break every page for that user.
- **Two dead instructor pages are gone**: `blockpy/browse_submissions` and `blockpy/watch`.
  Both crashed on use; the grader dashboard's watch view is a different, working page.

## Follow-ups (not part of this deploy)

- Check production for duplicate `assignment.url` and `assignment_group.url` values, then add
  unique constraints so the application check is backed by the database.
- Deferred from the October 2026 backend review, in the order they were weighed: uniqueness
  for `submission (assignment_id, user_id, course_id)`, `authentication (type, value)`,
  `role (user_id, course_id, name)` and `lower("user".email)` (run the duplicate-detection
  queries first); caps and streaming for the unbounded `submission_log` reads (`load_history`,
  `student_report`, `external/dump_logs`, `estimate_duration`); the broken
  `clear_old_anonymous_users` command; and bringing Alembic back in line with production.
