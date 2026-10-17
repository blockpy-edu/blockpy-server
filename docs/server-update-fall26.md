# Server update guide, fall 2026

This is the operator's checklist for deploying the `unify-security-audit` branch, which merges
`audit-logging` (audit tables, review pages, error recording) with `security-uploads-similarity`
(uploads and reports moved out of `static/`, authorization fixes, course-creation limits).

Everything below assumes the Docker Compose deployment (`web`, `huey`, `db`, `redis`, `nginx`).
Commands are run from the checkout on the server. Steps are in the order they must happen; the
reasons are in the notes under each step.

## Summary of what changes

| Area | Change | Action needed on the server |
|---|---|---|
| Database schema | Five foreign keys dropped from the log tables, one index added | Run `fall26_audit_log_fk.sql` by hand **before** the new code starts |
| Filesystem | Uploads and reports move from `static/uploads`, `static/reports` to `data/uploads`, `data/reports` | New `data_volume`; copy the old files across once |
| nginx | Only TLS 1.2 and 1.3 are offered | Recreate the nginx container so the template is re-rendered |
| Config | New defaults: 1-day JWT lifetime, 14-day remember cookie, course-creation limits | Nothing required; override in `instance/configuration.py` only if you want different values |
| Scheduled work | `error_log` grows with every unhandled error | Add a cron entry for `manage.py prune_error_logs` |

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

| Key | Default | Meaning |
|---|---|---|
| `JWT_ACCESS_TOKEN_EXPIRES` | 1 day (was 30) | Lifetime of the token embedded in editor pages for LTI iframes. A fresh LTI launch mints a new one; tokens issued before the deploy stay valid until their own expiry |
| `REMEMBER_COOKIE_DURATION` | 14 days (was Flask-Login's one year) | Remember-me cookie set by LTI and JWT logins |
| `COURSE_CREATION_NEW_ACCOUNT_HOURS` / `_LIMIT` | 24 / 1 | Accounts younger than this may own at most this many courses |
| `COURSE_CREATION_DAILY_LIMIT` | 5 | Courses any non-exempt account may create per rolling day |
| `COURSE_CREATION_PUBLIC_AFTER_DAYS` | 7 | Younger, unconfirmed accounts have `public` downgraded to `private` with a flash message |
| `PREFERRED_LOGIN_URL` | `None` | Where anonymous users are redirected by `login_required`. Replaces the old `PREFERRED_LOGIN` key; set it if your instance config used the old name |

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

## Follow-ups (not part of this deploy)

- Check production for duplicate `assignment.url` and `assignment_group.url` values, then add
  unique constraints so the application check is backed by the database.
- The remaining open security items, in order of weight: CSRF on state-changing forms (needs a
  token header in the client), email-confirmation account hijack (needs `SECURITY_CONFIRMABLE`
  and a backfill), LTI nonce replay, rate limiting on login/reset/register, and the
  query-string JWT location.
- Decide whether to rotate the LTI consumer secret. It was shown to anonymous visitors on the
  `add_canvas` page before this deploy; the page is now admin-only, but the secret is unchanged.
