# Audit Logging: Review and Development Plan

Status: plan. Nothing here has been implemented yet.
Reviewed 2026-09-13 against `master` at `e1ad149a`, then re-verified line by line
against the code on the same day. Corrections from the second pass are marked
**(revised)** so the reasoning behind each change stays visible.

Scope: the six tables under `models/log_tables/` (`course_log`, `role_log`,
`assignment_log`, `submission_log`, `access_log`, `error_log`) and their enums in
`models/enums/logs.py`.

Line numbers below are as of `e1ad149a` and will drift. Function names are the
stable reference.

---

## 0. Facts that shape the plan

### 0.1 Enums are `VARCHAR` in production, not database enums

Production Postgres was upgraded with the hand-run `sum25_upgrade_sql.sql` (UTF-16
encoded, so plain `grep` misses it; use `iconv -f UTF-16 -t UTF-8`). The Alembic file
`migrations/versions/981662a4cab3_prism_update.py` still declares `sa.Enum(...)` types
and is stale. `SubmissionLog`-style `Enum(..., values_callable=get_enum_values)` only
maps values on the Python side.

| Column | Production type | Longest current value |
|---|---|---|
| `course_log.event_type` | `VARCHAR(9)` | `corrupted` (9) |
| `role_log.event_type` | `VARCHAR(7)` | `removed` (7) |
| `assignment_log.event_type` | `VARCHAR(9)` | `corrupted` (9) |
| `submission_log.event_type` | `VARCHAR(255)` | free-form string |

Adding a Python enum member needs no migration if the new value fits the width.

### 0.2 Every log table has `NOT NULL` foreign keys, and tests never enforce them

Verified from the SQL script. The full set, because section 5 depends on it:

| Table | Foreign keys |
|---|---|
| `course_log` | `course_id → course`, `subject_id → user` |
| `role_log` | `role_id → role`, `course_id → course`, `subject_id → user`, `authorizer_id → user` |
| `assignment_log` | `assignment_id → assignment`, `course_id → course`, `subject_id → user` |
| `submission_log` | `submission_id → submission`, `assignment_id → assignment`, `course_id → course`, `subject_id → user` |
| `access_log` | `subject_id → user` |
| `error_log` | `access_log_id → access_log` |

SQLite does not enforce foreign keys unless `PRAGMA foreign_keys=ON` is set, and
`tests/conftest.py` builds the schema with `db.create_all()` and never sets it. A test
can log a `REMOVED` event against a role and then delete the role; Postgres would
reject one of the two.

**(revised)** The first draft only listed `role_log.role_id`, `course_log.course_id`,
and `assignment_log.assignment_id`. Deleting a *course* also strands
`role_log.course_id`, `assignment_log.course_id`, and `submission_log.course_id`. The
production SQL in section 5 covers all of them.

### 0.3 The model layer has no user context

**(revised)** This was implicit in the first draft and is the main design constraint.
`CourseLog.subject_id` and `RoleLog.authorizer_id` are `NOT NULL`, but the model
methods the plan wants to log from have no idea who is acting:

- `Course.rename(course_id, name)`, `Course.change_course_visibility(course_id, visibility)`, `Course.remove(course_id)` are static and take no user.
- `Role.new(name, user_id, course_id, ...)`, `Role.remove(self)`, `Role.update_role(self, new_role)` know the subject but not the authorizer.
- `User.update_roles(new_roles, course_id)` bypasses `Role.new` entirely: it bulk-deletes by id and adds bare `Role(...)` objects.

So "log in the model layer" means adding an explicit actor parameter to each of these
methods. That is the bulk of phase 2.

---

## 1. Table-by-table status

| Table | Written by | Read by | Verdict |
|---|---|---|---|
| `course_log` | Nothing. `CourseLog.new` has zero callers. | Nothing. | Dead. Repair is the main goal. |
| `role_log` | Nothing. `RoleLog.new` has zero callers. | Nothing. | Dead. Same. |
| `assignment_log` | Four call sites, all `EDIT`: `save_instructor_file` and `save_assignment` and `fork_assignment` in `blockpy.py`, `edit_security_settings` in `assignment_groups.py`. | Nothing. | Partial. Create, delete, fork, rename, move are unlogged. |
| `submission_log` | ~20 call sites through `make_log_entry` plus `Submission.from_assignment`; the client can write any `event_type` via `blockpy.log_event`. | Counters, analytics, history, duration estimates, late penalties, admin `LogView`, ProgSnap export. | Working. Event vocabulary only partly captured by the enum. |
| `access_log` | Nothing. | Nothing. | Dead. No request hook. |
| `error_log` | Nothing. `handle_500` in `controllers/errors.py` writes to the Python logger only. | Nothing. | Dead. Depends on `access_log`. |

### 1.1 Inventory of unlogged mutations

Course and role:

| Event | Entry point | Model method |
|---|---|---|
| Course create | `courses.add` | `Course.new` (also creates the owner's instructor `Role`) |
| Course edit (name, url, visibility, term, settings JSON) | `courses.edit` | `Course.edit` |
| Course rename | `courses.rename_course` | `Course.rename` |
| Visibility change (`archived` is a visibility value, not a column) | `courses.change_course_visibility` | `Course.change_course_visibility` |
| Course delete | `courses.remove_course`; `scripts/db_commands.py` `delete_course` | `Course.remove` |
| Owner transfer | Flask-Admin `CourseView` only | none |
| Lock / unlock | Flask-Admin `CourseView` only | none |
| Pin setting | `courses.pin_course` | `Course.set_setting` |
| Textbook add/remove | `courses.edit_textbooks` | `Course.do_textbook_action` → `set_setting` |
| LTI course create / endpoint update | `auth.load_lti_user` | `Course.from_lti` → `new_lti_course` |
| Role add, bulk | `courses.add_users` | `User.add_role` → `Role.new` |
| Role remove | `courses.remove_role` | `Role.remove` |
| Role change | `courses.change_role` | `Role.update_role` (broken, see 2.1) |
| LTI role sync | `auth.load_lti_user` | `User.update_roles` |

Course-level events that are not Course columns:

| Event | Entry point | Today |
|---|---|---|
| Adopt / unadopt | `courses.adopt_assignments` → `Submission.adopt` / `delete_completely` | `SubmissionLog File.Create` only |
| Fork into a course | `blockpy.fork_assignment`, `assignment_groups.fork_group`, `assignment_groups.forking_menu`, `assignments.fork` | `blockpy` path logs `EDIT` on the *source* assignment only |
| Bulk submission transfer | `assignments.transfer_course`, `assignments.bulk_transfer_course` | Nothing |
| Exam time-limit change | `courses.modify_time` | `SubmissionLog extend_time` per submission. Adequate. |

Assignment and group (for `assignment_log`):

| Event | Entry point | Today |
|---|---|---|
| Create | `assignments.new_assignment` → `Assignment.new` | No |
| Delete | `assignments.remove_assignment` → `Assignment.remove` | No. Deletes `submission_log` rows but not `assignment_log` rows |
| Move between courses | `assignments.move_course` → `Assignment.move_course` | No |
| Fork | four sites above | No `FORK` event |
| Settings edit | `blockpy.save_assignment` | `EDIT field="assignment_settings.blockpy"` |
| Instructor file save | `blockpy.save_instructor_file` | `EDIT field=<filename>` |
| Instructor file rename | `blockpy.rename_file` | No |
| Group create / edit / delete / fork / move membership | `assignment_groups.*` | No (only `edit_security_settings` logs, on each member assignment) |

### 1.2 `submission_log` event vocabulary

`SubmissionLog.event_type` is a free `String(255)`. Server-written values:

- From `SubmissionLogEvent`: `File.Create`, `File.Edit`, `Session.Start`, `error`, `extend_time`, `start_timer`, `clear_timer`.
- From `LogEventType` in `models/generics/definitions.py`: `X-Submission.LMS`, `X-Unchanged.LMS`, `X-Submission.LMS.Failure`, `X-Quiz.Grade.Failure`, `X-IP.Blocked`, `Submit`.
- Bare literals with no constant: `X-Submission.Get`, `X-View.Submission`, `X-Image.Save` (`blockpy.py`), `X-Grade.Instructor` (`grading.py`), `X-Submission.LMS.Retry-Failure` (`tasks.py`).
- Read but never written server-side: `Intervention`, `Resource.View`, `X-Quiz.Grade`, `feedback`. These come from the client.

`blockpy.log_event` accepts any `event_type` string by design. Not changing that.

---

## 2. Bugs found on the way

All confirmed against the code.

### 2.1 Blocking (must fix before logging can work)

| # | Where | Bug |
|---|---|---|
| B1 | `Role.update_role` (`models/role.py:47`) | References `self.CHOICES`, which does not exist on `Role`. `courses.change_role` always raises `AttributeError`. |
| B2 | `Course.log_action_by_user` (`models/course.py:492`) | Constructs `models.Log`, which is not exported from `models/__init__.py`. The only caller is the settings-parse-failure branch of `set_setting`. `pin_course` wraps this in `try/except` so the user sees `success=False` rather than a 500; `edit_textbooks` does not. |
| B3 | `Course.do_textbook_action` (`models/course.py:510`) | Passes `user_id` (an `int`) to `set_setting`, which expects an object with `.id`. Only fails on the same parse-failure branch. |

### 2.2 Non-blocking (fix in phase 1 because they are one-liners in files being touched anyway)

| # | Where | Bug |
|---|---|---|
| B4 | `abort_with_failure` (`controllers/helpers.py:48`) | `as_html=True` calls `abort(200, message)`. Werkzeug has no exception class for 200, so it raises `LookupError`. No caller currently passes `as_html=True`. Fix: use 403 in that branch. |
| B5 | `Submission.log_code` (`models/submission.py:770`) | Marked deprecated, zero callers, calls `SubmissionLog.new` with wrong positional order and keyword arguments (`body`, `timestamp`) that do not exist. Delete. |
| B6 | `SubmissionLog.event_type` default | `SubmissionLogEvent.UNKNOWN.name` gives `"UNKNOWN"`; every other write uses `.value` (`"unknown"`). Use `.value`. |
| B7 | `blockpy.fork_assignment` (`blockpy.py:1215`) | Passes the string `"edit"` rather than `AssignmentLogEvent.EDIT`. Harmless because the enum is a `StrEnum`, but inconsistent. |
| B8 **(revised, new)** | `blockpy.fork_assignment` (`blockpy.py:1197`) | The group branch calls `group.fork()` with no arguments. `AssignmentGroup.fork` requires `new_owner_id` and `new_course_id`, so forking a group through this endpoint raises `TypeError`. Fix: `group.fork(user_id, course_id)`. |

### 2.3 Pre-existing production hazard (informational)

`Assignment.remove` deletes `submission_log` rows but not `assignment_log` rows. Any
assignment whose settings were ever saved through `save_assignment` has
`assignment_log` rows pointing at it, so deleting it should fail on Postgres today with
a foreign-key violation. Section 5 resolves this as a side effect.

Similarly, `Course.remove(course_id)` without `remove_linked` deletes the course row
while `role.course_id`, `assignment.course_id`, and `submission_log.course_id` still
point at it. Whether that fails in production depends on whether those older tables
carry constraints; the newer log tables definitely do. Out of scope, but the section 5
SQL removes the log-table half of the problem.

---

## 3. Design decisions

### 3.1 Enum additions

`CourseLogEvent` gains three values, all 9 characters or fewer for `VARCHAR(9)`:

| Value | Meaning | `field` / `value` |
|---|---|---|
| `ADOPT = "adopt"` | Instructor submission created by `adopt_assignments` | `"assignment_id"` / `str(assignment.id)` |
| `UNADOPT = "unadopt"` | Instructor submission deleted by `adopt_assignments` | `"assignment_id"` / `str(assignment.id)` |
| `FORK = "fork"` | An assignment or group was forked *into* this course | `"assignment_id"` or `"assignment_group_id"` / `str(new.id)` |

Bulk submission transfer reuses `TRANSFER` with `field="assignment_group_id"` and
`value=str(count)`, one row on the source course and one on the destination.
`ARCHIVE` stays defined but unused; archiving is `EDIT field="visibility"
value="archived"`. Lock is `EDIT field="locked"` because `locked` is a column.

`CourseLog.new` only runs the `hasattr(models.Course, field)` check for `EDIT`, so the
new events are free to put foreign ids in `field`.

`RoleLogEvent`: no changes. `event_value` holds the role name, new name for
`GIVEN`/`CHANGED`, old name for `REMOVED`.

`AssignmentLogEvent`: no changes. All the needed values exist and are simply never
written. Move between courses is `EDIT field="course_id"`.

`SubmissionLogEvent`: add the five bare literals and the six `LogEventType` values as
members, then turn `LogEventType` into thin aliases so no call site changes:

```python
# models/enums/logs.py (additions to SubmissionLogEvent)
X_SUBMISSION_GET = "X-Submission.Get"
X_VIEW_SUBMISSION = "X-View.Submission"
X_IMAGE_SAVE = "X-Image.Save"
X_GRADE_INSTRUCTOR = "X-Grade.Instructor"
X_LMS_SUBMISSION = "X-Submission.LMS"
X_LMS_UNCHANGED = "X-Unchanged.LMS"
X_LMS_FAILURE = "X-Submission.LMS.Failure"
X_LMS_RETRY_FAILURE = "X-Submission.LMS.Retry-Failure"
X_QUIZ_GRADE_FAILURE = "X-Quiz.Grade.Failure"
X_IP_BLOCKED = "X-IP.Blocked"
X_SUBMIT = "Submit"

# models/generics/definitions.py
class LogEventType:
    LMS_SUBMISSION = SubmissionLogEvent.X_LMS_SUBMISSION
    ...
```

### 3.2 Where each event is logged

Rule: log in the model method when it is the only mutation path and can be given an
actor id cheaply. Log in the endpoint when the model method has no actor and adding one
would change many callers, or when the "event" is a composite the model does not know
about (adopt, fork into course, bulk transfer).

| Event | Log from | Actor source |
|---|---|---|
| Course `CREATE` | `Course.new` | `owner_id` |
| LTI course `CREATE`, `EDIT field=endpoint` | `Course.new_lti_course`, `Course.from_lti` | `user_id` already passed |
| `RENAME` | `Course.rename(course_id, name, subject_id)` | new param |
| `EDIT field=visibility` | `Course.change_course_visibility(course_id, visibility, subject_id)` | new param |
| `EDIT` per changed field | `Course.edit(..., subject_id)` | new param; one row per field whose value actually changed |
| `EDIT field=settings`, `CORRUPTED` | `Course.set_setting(key, value, user_id)` | change param from user object to id |
| `DELETE` | `courses.remove_course` and `db_commands.delete_course`, *before* calling `Course.remove` | `g.user.id`; the CLI uses the admin user (id 1) |
| `TRANSFER`, `EDIT field=locked` | `CourseView.on_model_change` in `controllers/admin.py` | `g.user.id` |
| `ADOPT` / `UNADOPT` | `courses.adopt_assignments`, in the loop, only when `created` / actually deleted | `user_id` |
| `FORK` | the four fork endpoints, on the target course | `g.user.id` |
| `TRANSFER` (bulk) | `assignments.bulk_transfer_course`, on source and destination | `user_id` |
| Role `GIVEN` | `Role.new(..., authorizer_id=None)`; `None` means self-grant, so `authorizer_id = user_id` | `User.add_role(name, course_id, authorizer_id=None)` threads it through; `Course.new` passes `owner_id` |
| Role `REMOVED` | `Role.remove(self, authorizer_id=None)` | same convention |
| Role `CHANGED` | `Role.update_role(self, new_role, authorizer_id=None)` | same |
| LTI role sync | `User.update_roles`: read stale roles as objects before deleting so their ids and names are available; `flush()` after adding so new ids exist; `authorizer_id = self.id` | self |

Roles with `course_id is None` (the global `admin` role) are not logged, because
`role_log.course_id` is `NOT NULL`. `Role.new` skips logging when `course_id` is
`None`.

### 3.3 Helper for client timestamps

The existing `AssignmentLog` call sites pass `"", ""` for `client_timestamp` and
`client_timezone`, while `make_log_entry` pulls them from `request.values`. Add one
helper in `controllers/helpers.py` and use it from endpoint-level log calls:

```python
def client_time_fields():
    """(timestamp, timezone) from the request, or ("", "") outside one."""
    if not has_request_context():
        return "", ""
    return request.values.get('timestamp', ''), request.values.get('timezone', '')
```

Model-level log calls leave the two fields at their default. Not worth threading
request state into models.

### 3.4 Delete `Course.log_action_by_user`

It has one caller, a `(action, message)` shape that does not fit `field`/`value`, and a
misleading name. `set_setting` calls `CourseLog.new(...)` directly.

---

## 4. Development plan

Seven phases. Each one is a separate commit and leaves the suite green. Phases 1 and 2
are the core; 3 through 7 are independent of each other after phase 2, except that
phase 6 needs phase 2's data to be worth looking at and its errors page needs phase 5.

Baseline check before starting:

```
python -m pytest tests/controllers/test_courses.py tests/controllers/test_adopt_assignments.py -q
```

The course suite had 72 passing tests at `e1ad149a`.

### Phase 1: bug fixes and dead code (no schema or behavior change for users)

Files: `models/role.py`, `models/course.py`, `models/submission.py`,
`models/log_tables/submission_log.py`, `controllers/helpers.py`,
`controllers/endpoints/blockpy.py`, `models/enums/logs.py`,
`models/generics/definitions.py`.

1. `Role.update_role`: replace the `CHOICES` check with `new_role in UserRoles.__members__.values()` (or `try: UserRoles(new_role) except ValueError`). Keep the return contract: the new name on success, `None` otherwise.
2. Delete `Course.log_action_by_user`. Rewrite the failure branch of `set_setting` to call `models.CourseLog.new(self.id, user_id, CourseLogEvent.CORRUPTED, field="settings", value=self.settings)`. Change the signature to `set_setting(self, key, value, user_id: int)` and update `pin_course` to pass `g.user.id`. `do_textbook_action` already passes an id, so it becomes correct without change.
3. Delete `Submission.log_code`.
4. `SubmissionLog.event_type` default: `.value`.
5. `abort_with_failure`: `abort(403, message)` when `as_html`.
6. `blockpy.fork_assignment`: `AssignmentLogEvent.EDIT` instead of `"edit"`; `group.fork(user_id, course_id)` instead of `group.fork()`.
7. Enum additions from 3.1, including `LogEventType` aliases.

Tests (new file `tests/controllers/test_audit_logs.py`, class `TestPhase1Fixes`):

- `Role.update_role("proctor")` returns `"proctor"` and the row changes; `update_role("bogus")` returns `None` and the row is unchanged.
- `POST /courses/change_role` with `role_id=1000, new_role=teachingassistant` as Ada returns success and role 1000 is now `teachingassistant`.
- Set course 6 `settings` to `"{not json"`, call `set_setting("pinned", True, 10)`: no exception, settings parse afterwards, one `CourseLog CORRUPTED` row with `field="settings"`.
- `POST /courses/edit_textbooks` add as Ada on a course with corrupted settings does not raise.
- `require_course_instructor(lulu, 6, as_html=True)` raises `Forbidden`.
- `POST /blockpy/fork_assignment` with `assignment_group_id=1` and `course_id=6` as Ada returns success and creates a new group in course 6.
- `LogEventType.LMS_SUBMISSION == "X-Submission.LMS"` (guards the alias refactor).

### Phase 2: wire `course_log` and `role_log`

Files: `models/course.py`, `models/role.py`, `models/user.py`,
`controllers/endpoints/courses.py`, `controllers/admin.py`, `controllers/auth.py`,
`scripts/db_commands.py`, `controllers/helpers.py`.

Model changes:

1. `Course.new`: after `flush()`, `CourseLog.new(new_course.id, owner_id, CourseLogEvent.CREATE)`; pass `authorizer_id=owner_id` to `Role.new`.
2. `Course.new_lti_course`: `CREATE` with `subject_id=user_id`. `Course.from_lti`: on endpoint change, `EDIT field="endpoint" value=endpoint` with `subject_id=user_id`.
3. `Course.rename(course_id, name, subject_id)`: `RENAME` with `value=name`. One caller.
4. `Course.change_course_visibility(course_id, visibility, subject_id)`: `EDIT field="visibility"`. One caller.
5. `Course.edit(self, subject_id, name=None, ...)`: for each field, compare against the current value and only assign and log when different. Returns `modified` as before. One caller.
6. `Course.set_setting`: after a successful write, `EDIT field="settings" value=json.dumps({key: value})`. The `CORRUPTED` row from phase 1 stays.
7. `Role.new(..., authorizer_id=None)`: after commit, if `course_id is not None`, `RoleLog.new(instance.id, course_id, user_id, authorizer_id or user_id, RoleLogEvent.GIVEN, str(name))`.
8. `Role.remove(self, authorizer_id=None)`: log `REMOVED` with `event_value=str(self.name)` *before* the delete, capturing `self.id` first.
9. `Role.update_role(self, new_role, authorizer_id=None)`: log `CHANGED` with `event_value=new_role` on success.
10. `User.add_role(name, course_id, authorizer_id=None)`: pass through.
11. `User.update_roles`: replace the bulk `.delete()` with a loop over stale role objects that logs `REMOVED` then deletes; after adding new `Role` objects, `db.session.flush()` and log `GIVEN` for each. `authorizer_id=self.id`.

Endpoint changes:

12. `courses.add`, `courses.rename_course`, `courses.change_course_visibility`, `courses.edit`, `courses.pin_course`: pass `g.user.id` where the new parameters require it.
13. `courses.remove_course`: `CourseLog.new(course_id, g.user.id, CourseLogEvent.DELETE)` before `Course.remove`. `db_commands.delete_course`: same with `subject_id=1`, the seeded admin user. Decided 2026-09-13.
14. `courses.add_users`: `new_user.add_role(role, course_id=course_id, authorizer_id=g.user.id)`.
15. `courses.remove_role`: `role.remove(authorizer_id=g.user.id)`. `courses.change_role`: `role.update_role(new_role, authorizer_id=g.user.id)`; return failure when it returns `None` instead of reporting success unconditionally.
16. `courses.adopt_assignments`: inside the adopt loop, log `ADOPT` when `created`; inside the unadopt loop, log `UNADOPT` for each deleted submission.
17. Fork endpoints (`assignments.fork`, `assignment_groups.fork_group`, `assignment_groups.forking_menu`, `blockpy.fork_assignment`): after the fork, `CourseLog FORK` on the target course with `field="assignment_id"` or `"assignment_group_id"` and `value=str(new.id)`. When a group is forked, one row for the group, not one per member.
18. `assignments.bulk_transfer_course`: after the transfer, `TRANSFER` rows on both courses with `field="assignment_group_id"` and `value=str(len(moved))`.
19. `controllers/admin.py` `CourseView.on_model_change`: use `sqlalchemy.inspect(model).attrs.owner_id.history` and `.attrs.locked.history` to detect changes. Log `TRANSFER value=str(new_owner_id)` and `EDIT field="locked" value=str(locked)` with `subject_id=g.user.id`. Skip when `is_created`.

Tests (`tests/controllers/test_audit_logs.py`, acting as Ada, user 10, unless noted;
seed data: Ada is instructor of course 6 via role 102, Lulu is user 100 with learner
role 1000 in course 6, course 3 is owned by Babbage (11) and holds assignment 120,
assignment 100 is in course 6):

| # | Action | Expected rows |
|---|---|---|
| C1 | `POST /courses/add` | one `CourseLog CREATE` by 10 on the new course; one `RoleLog GIVEN` with `event_value="instructor"`, `subject_id=10`, `authorizer_id=10` |
| C2 | `POST /courses/rename` course 6 | `RENAME`, `value` = new name |
| C3 | `POST /courses/change_course_visibility` course 6 | `EDIT field="visibility"` |
| C4 | `POST /courses/edit/6` changing only term and url | exactly two `EDIT` rows, `field` in `{"term","url"}`; a second identical POST adds no rows |
| C5 | `POST /courses/pin_course` | `EDIT field="settings"` |
| C6 | `POST /courses/edit_textbooks` add | `EDIT field="settings"` |
| C7 | `POST /courses/remove` as admin (user 1) | `DELETE` for course 6 |
| C8 | `Course.from_lti` with a new `context_id` then again with a new endpoint | `CREATE` then `EDIT field="endpoint"` |
| R1 | `POST /courses/add_users/6` with a new email, role learner | `GIVEN`, `event_value="learner"`, `authorizer_id=10`, `subject_id` = new user |
| R2 | `POST /courses/remove_role/1000` | `REMOVED`, `event_value="learner"`, `subject_id=100`, `role_id=1000` |
| R3 | `POST /courses/change_role` 1000 → `teachingassistant` | `CHANGED`, `event_value="teachingassistant"` |
| R4 | `User.update_roles(["instructor"], 6)` on Lulu | one `REMOVED learner` and one `GIVEN instructor`, both `authorizer_id=100`; new row has a non-null `role_id` |
| R5 | `Role.new("admin", user_id=100)` with no course | no `RoleLog` row, no error |
| E1 | adopt then unadopt assignment 120 from course 3 into 6 | `ADOPT` then `UNADOPT`, `field="assignment_id"`, `value="120"`; adopting twice logs once |
| E2 | `POST /assignments/fork` assignment 120 into course 6 | `CourseLog FORK` on 6, `field="assignment_id"`, `value` = new id |
| E3 | `POST /assignment_group/fork` group 10 | `CourseLog FORK` on the target course, `field="assignment_group_id"` |
| A1 | Flask-Admin: edit course 6 `owner_id` to 11 as admin | `TRANSFER value="11"`; editing `locked` gives `EDIT field="locked"` |

Extend `tests/controllers/test_adopt_assignments.py` for E1 rather than duplicating
its helpers.

### Phase 3: production SQL for foreign keys (deploy before phase 2 goes live)

See section 5 for the reasoning. Ship as `fall26_audit_log_fk.sql` next to
`sum25_upgrade_sql.sql`, plain UTF-8 this time:

```sql
-- Confirm names first with: \d role_log, \d course_log, \d assignment_log
ALTER TABLE role_log        DROP CONSTRAINT IF EXISTS role_log_role_id_fkey;
ALTER TABLE role_log        DROP CONSTRAINT IF EXISTS role_log_course_id_fkey;
ALTER TABLE course_log      DROP CONSTRAINT IF EXISTS course_log_course_id_fkey;
ALTER TABLE assignment_log  DROP CONSTRAINT IF EXISTS assignment_log_assignment_id_fkey;
ALTER TABLE assignment_log  DROP CONSTRAINT IF EXISTS assignment_log_course_id_fkey;
```

Indexes on those columns stay. The `ForeignKey(...)` declarations in the models stay so
relationship loading keeps working. `subject_id` and `authorizer_id` constraints stay,
since users are not deleted.

Also add `PRAGMA foreign_keys=ON` to the SQLite engine in `tests/conftest.py` via an
`engine_connect` listener so tests catch this class of bug. **Do this as its own commit
after phase 2**: it will immediately fail any test that deletes an assignment with
`assignment_log` rows or a course with `role_log` rows, which is the point, and those
failures have to be triaged against the section 5 decision. If the pragma turns up
unrelated pre-existing violations elsewhere in the suite, gate it behind an
environment variable rather than blocking this work.

### Phase 4: `assignment_log` coverage

Lower priority; the table already has real data. Files:
`controllers/endpoints/assignments.py`, `controllers/endpoints/assignment_groups.py`,
`controllers/endpoints/blockpy.py`, `models/assignment.py`.

| Event | Where | Row |
|---|---|---|
| `CREATE` | `assignments.new_assignment` after `Assignment.new` | `field=None` |
| `DELETE` | `assignments.remove_assignment` before `Assignment.remove` | requires phase 3 in production |
| `FORK` | the four fork sites, on the *new* assignment | `field="forked_id"`, `value=str(source.id)` |
| `EDIT field="course_id"` | `assignments.move_course` | `value=str(new_course_id)` |
| `RENAME` | `blockpy.rename_file` when `placement == "assignment"` | `field=old_filename`, `value=new_filename` |

Group mutations have no group log table. Do not invent one now; group create, edit,
and delete are visible through the course log only as far as `FORK` goes. If group
auditing turns out to matter, that is a new table and a new spec.

Tests: `POST /assignments/new` → `CREATE`; `POST /assignments/remove` on 100 →
`DELETE` row present after the assignment is gone; `POST /assignments/move_course` →
`EDIT field="course_id"`; `POST /assignments/fork` → `FORK` on the new assignment with
`field="forked_id"`.

### Phase 5: `error_log` via a lazy `access_log` row

Decided 2026-09-13: record unhandled server errors in the database. Email
notification was considered and set aside; it is not the design being pursued.

Three shapes were weighed. A per-request `access_log` row (one committed insert on
every request, no retention policy) was rejected on cost. A nullable
`error_log.access_log_id` was rejected because `error_log` only holds type, message,
and traceback; the who and where of the failure live on `access_log`, and dropping the
link throws them away. The chosen shape keeps the schema exactly as designed and
writes an `access_log` row only when a request fails:

1. `handle_500` in `controllers/errors.py` and `handle_lti_exception` (LTI failures bypass the 500 handler and are the errors instructors report most) both call a new `record_error(original)` helper in the same file.
2. `record_error` first does `db.session.rollback()`, because the session that raised is almost always in a failed transaction. Then `AccessLog.new(g.user.id, request.path, request.method, request.remote_addr, timestamp, timezone)` followed by `ErrorLog.new(access.id, type(original).__name__, str(original)[:2000], traceback.format_exc())`. `g.user` is always a real row here, because `login_user_if_able` substitutes a persisted anonymous user, so `access_log.subject_id` can stay `NOT NULL`. Client `timestamp` and `timezone` come from `client_time_fields()` (phase 2, 3.3).
3. The whole helper is wrapped in `try/except Exception`. On any failure it logs to `current_app.logger` and returns; the file log in `interaction_logger.py` stays the source of truth and the database is a convenience view. The handler must never raise, especially when the original error is the database being unreachable.
4. No schema change. The two tables exist in production with the right constraints. `error_log.message` is `TEXT`, so the 2000-character cap is a hygiene choice, not a constraint.
5. Volume control: before inserting, `record_error` looks for an `error_log` row in the last 10 minutes with the same `error_type` and the same last traceback line. If one exists it still inserts (the `access_log` row is what makes each occurrence useful) but the errors page groups them. Pruning is a `db_commands` subcommand, `prune_error_logs --days 90`, deleting `error_log` rows and then orphaned `access_log` rows older than the cutoff. Run by hand or from cron; not automatic.
6. Privacy: tracebacks and messages can contain student code, emails, and LTI parameters. `dump_db` in `scripts/db_commands.py` enumerates tables explicitly and does not include either table; keep it that way and add a comment saying why. The research export tooling gets the same exclusion.

Not covered, deliberately: errors returned as `ajax_failure` with a 200 status, and
errors inside huey tasks. The first are handled failures by design. The second already
write a submission log row for the grade-posting case; anything else there is a file
log matter.

Tests (`tests/controllers/test_error_log.py`):

- Register a throwaway route in the test app that raises `RuntimeError("boom")`. A GET as Lulu produces one `access_log` row with `subject_id=100`, `route` equal to the path, and `method="GET"`, and one `error_log` row pointing at it with `error_type="RuntimeError"` and a traceback containing the route function's name.
- The same as an anonymous client produces a row whose subject is the anonymous user, not a failure.
- Patch `ErrorLog.new` to raise. The 500 response is still returned, the response body is the generic error page, and nothing propagates.
- Raise inside a route after a `db.session.add` of an unflushed object. The access row is still written, showing the rollback happened first.
- An `LTIException` also produces an error row.
- `prune_error_logs --days 0` removes rows and leaves no orphaned `access_log` rows.

### Phase 6: admin review pages

Two layers. The first is raw table access through Flask-Admin, which is cheap and
should exist regardless. The second is a small set of purpose-built pages that answer
the questions an admin actually has ("what happened to this course", "what did this
TA change", "who deleted that assignment") without reading rows one at a time.

#### 6a. Flask-Admin views for every log table

File: `controllers/admin.py`, replacing the `# TODO: Other logs tables` comment.

Add `CourseLogView`, `RoleLogView`, `AssignmentLogView`, `ErrorLogView`, and
`AccessLogView`, all under a new `category='Logs'` alongside the
existing `LogView` for `SubmissionLog`. Common settings:

- `can_create = can_edit = can_delete = False`. Audit rows are immutable; the admin panel must not be a way to rewrite history.
- `can_export = True`.
- `column_default_sort = ('date_created', True)`.
- `form_ajax_refs` for `subject`, `course`, `assignment`, `authorizer` using the existing `make_ajax_fields` helper, so filters show names rather than ids.
- `column_filters` on `date_created`, every id column, and `event_type`.
- `AssignmentLogView.column_formatters = {'value': _render_code}` (the same formatter `LogView` uses) because `value` holds whole file contents.

Half a day of work. No tests beyond a smoke test that an admin gets 200 on each list
page and a non-admin does not.

#### 6b. Normalized event feed

Everything below reads through one JSON endpoint so the pages are thin. New blueprint
`controllers/endpoints/audit.py` with `url_prefix='/audit'`, registered in `main.py`
next to the other blueprints. Access is decided per route by one helper,
`require_audit_scope(course_id=None, assignment_id=None)`:

- An admin passes with any scope, including none.
- Anyone else must supply a `course_id` they instruct, or an `assignment_id` whose assignment's own `course_id` they instruct. Adopting an assignment from another course does not grant access to that assignment's history; the history belongs to the course that owns it.
- A non-admin request with no scope, or with a scope they do not instruct, is refused. HTML routes use the `as_html` branch of `abort_with_failure` fixed in phase 1 (B4) so the refusal is a 403 page rather than a JSON blob.

The feed endpoint applies the scope as a hard filter server-side, not as a default the
client could omit: when the caller is not an admin, `course_id` is forced into every
per-table query and `subject_id` filters are applied on top of it, never instead of it.

Normalized event shape, produced by a new `encode_json()` on `CourseLog`, `RoleLog`,
and `AssignmentLog` (only `SubmissionLog` has one today):

```json
{
  "table": "course_log",
  "id": 42,
  "when": "2026-09-13T14:02:11Z",
  "event_type": "edit",
  "subject": {"id": 10, "first_name": "Ada", "last_name": "Bart", "email": "ada@blockpy.com"},
  "authorizer": null,
  "course": {"id": 6, "name": "CS1 F20", "url": "cs1_f20"},
  "assignment": null,
  "role_id": null,
  "field": "visibility",
  "value": "archived",
  "value_truncated": false
}
```

`value` is cut at 500 characters in feed responses with `value_truncated: true`; the
full value comes from `GET /audit/event/<table>/<id>`. The `authorizer` key is only
non-null for `role_log`.

Endpoints:

| Route | Purpose | Parameters |
|---|---|---|
| `GET /audit/feed` | The unified feed | `tables` (csv of `course_log,role_log,assignment_log`), `course_id`, `subject_id`, `assignment_id`, `event_types` (csv), `since`, `before` (ISO timestamps), `search` (substring on `field` and `value`), `limit` (default 100, max 500) |
| `GET /audit/event/<table>/<id>` | One event with untruncated `value` | none |
| `GET /audit/diff/<table>/<id>` | Unified diff between this `assignment_log` row and the previous row with the same `assignment_id` and `field` | none |
| `GET /audit/summary` | Counts for the dashboard tiles | `since` (default 24 hours ago) |

Feed implementation: one query per requested table, each filtered, ordered by
`date_created desc, id desc`, and limited to `limit`; merge in Python by `when` and
truncate to `limit`. Three small queries beat a `UNION ALL` across tables with
different columns, and each one uses its existing `course_id` or `subject_id` index.
Paging is by `before`, passing the `when` of the last row shown. Events with identical
timestamps across a page boundary can be dropped or repeated; acceptable for an
admin tool, and the row `id` lets the client dedupe.

Before returning, collect every user, course, and assignment id across the page and
load each model with one `in_` query, holding the results in a local list so the
identity map does not drop them mid-encode (see the identity-map note in the project
memory). Never call `log.subject` per row.

`assignment_log` has one row per `save_assignment` call, so it is the only one of
the three that can grow large. None of the three tables has an index on
`date_created`. The global feed with no filters sorts a full scan. If that is slow on
the production copy, add `CREATE INDEX assignment_log_date_index ON assignment_log
(date_created)` by hand; the course-scoped pages are fine without it.

Diff endpoint: `difflib.unified_diff` over the previous and current `value`, split on
newlines, for `field` values that are file names or `assignment_settings.blockpy`.
For the settings field, pretty-print both sides as sorted JSON first so the diff is
by key rather than by serialization order. Returns `{"previous_id", "lines": [...]}`
where each line is `{"kind": "add" | "remove" | "context" | "header", "text"}`.

#### 6c. Pages

Templates under `templates/audit/`, extending `helpers/layout.html` like the analytics
page. One Knockout component, `frontend/components/audit/audit.ts`, registered in
`frontend/app.ts`, with the page telling it which filters are fixed. Chart.js is
already a dependency for the sparkline on the dashboard.

Access, decided 2026-09-13: the dashboard, the global feed, user history, and errors
are admin only. Course history and assignment history are open to instructors of the
owning course through `require_audit_scope`.

| Route | Page | What it fixes and shows |
|---|---|---|
| `/audit/` | Dashboard | Tiles: events per table in the last 24 hours and 7 days; a sparkline per table; a "destructive" list of the last twenty `DELETE`, `REMOVED`, `UNADOPT`, and `UNFORK` events; a "privilege" list of the last twenty `GIVEN` or `CHANGED` rows whose `event_value` is `instructor` or `admin`; a search box that accepts a user email, course id or url, or assignment id and jumps to the matching history page. |
| `/audit/feed` | Feed | The unfiltered feed with every filter exposed, grouped by day, "load more" at the bottom. |
| `/audit/course/<id>` | Course history | `course_id` fixed. Header shows current owner, visibility, locked, created by and when (from the `CREATE` row). Tabs: All, Settings (`course_log` only), Roster (`role_log` only, rendered as "Ada gave Lulu learner" sentences), Assignments (`assignment_log` for the course). |
| `/audit/user/<id>` | User history | Two feeds side by side: "Did" (`subject_id` fixed across all tables) and "Received" (`role_log` where this user is the role's subject). |
| `/audit/assignment/<id>` | Assignment history | `assignment_id` fixed. Each `EDIT` row has a "diff" toggle that calls the diff endpoint and renders it inline with add and remove lines colored. This is the page that makes the feature worth building: it answers "what changed in this problem between Tuesday and Thursday". |
| `/audit/errors` | Errors | Admin only. Groups `error_log` rows by `error_type` plus the last frame of the traceback, shows count and first and last seen, expands to the most recent twenty occurrences with user, route, and IP from the linked `access_log` row. A 24-hour and 7-day sparkline per group. |

Row rendering is shared: timestamp in the admin's timezone, subject as a link to the
user history page, target (course or assignment) as a link to its history page, event
type as a colored badge (green for create and given, red for delete and removed and
unadopt, grey for edit), then `field` and `value` with the truncated value expandable
in place.

Navigation: add an "Audit" link next to the existing "Admin" link in
`templates/helpers/layout.html`, guarded by the same `is_admin()` check, and a link to
`/audit/` from `templates/admin/index.html`.

#### 6d. Instructor access

Decided 2026-09-13: instructors see the history of their own courses.

- `/audit/course/<id>` and `/audit/assignment/<id>` call `require_audit_scope` with the id from the URL. The templates receive an `is_admin` flag and hide the links to user history, the global feed, and the dashboard when it is false; subject names on rows stay plain text for instructors instead of links.
- Add a "Course History" entry to the instructor menu in `templates/helpers/navigation.html`, and a "History" link on the assignment editor's settings panel that opens `/audit/assignment/<id>` for anyone who can edit the assignment.
- What an instructor sees is already theirs to see elsewhere: roster changes match the manage-users page, settings edits are their own course, and assignment file contents in `assignment_log.value` are files they can open in the editor. The one new exposure is `role_log.authorizer_id` on LTI syncs, which is the student themself, so nothing leaks.
- `assignment_log.course_id` is the course the editor was opened in, not necessarily the assignment's owning course. The course history page's Assignments tab filters on it, so an instructor sees edits made *from* their course. The assignment history page filters on `assignment_id` and is guarded by the owning course.

#### Tests

`tests/controllers/test_audit_pages.py`:

- Every `/audit/*` HTML route returns 403 for Lulu and 200 for the admin (user 1).
- Ada gets 200 on `/audit/course/6` and `/audit/assignment/100`, and 403 on `/audit/course/3`, `/audit/assignment/120`, `/audit/`, `/audit/feed`, `/audit/user/100`, and `/audit/errors`.
- As Ada, `/audit/feed?course_id=6` returns rows; `/audit/feed` with no scope and `/audit/feed?course_id=3` are refused; `/audit/feed?course_id=6&subject_id=11` returns only rows that are both in course 6 and by user 11.
- After Ada adopts assignment 120 into course 6, `/audit/assignment/120` is still 403 for her.
- Each Flask-Admin log list page returns 200 for the admin.
- After phase 2's C1 through C4 actions, `/audit/feed?course_id=6` returns the rows in reverse chronological order with `table`, `subject`, and `course` populated, and `/audit/feed?course_id=3` returns none of them.
- `/audit/feed?tables=role_log` returns only role events.
- `value` longer than 500 characters comes back truncated with the flag set, and `/audit/event/course_log/<id>` returns it whole.
- Two `save_assignment` calls on assignment 100, then `/audit/diff/assignment_log/<second id>` returns a `remove` line and an `add` line for the changed key and no lines for unchanged keys.
- `/audit/summary` counts match the rows created in the test.
- A feed request with `limit=9999` is capped at 500.

### Phase 7: cleanup

- Remove `# TODO: Log` comments at the sites that now log.
- Delete the stale `sa.Enum` declarations from `981662a4cab3_prism_update.py`, or add a comment at the top of the file saying production was upgraded by hand and this migration must not be run.
- Add a short `docs/audit-logs.md` describing the four active log tables, the `field`/`value` conventions from 3.1, and where the review pages from phase 6 live, so the next person does not need this document.

---

## 5. Foreign keys versus audit rows

`DELETE` on `course_log` and `REMOVED` on `role_log` are the events that make the
tables worth having, and both point at rows that are about to disappear. Options:

1. Delete the audit rows along with the parent. Matches `Assignment.remove`'s treatment of `submission_log`. Defeats the purpose.
2. Make the referencing columns nullable, null them on delete, keep the id in `value`. Preserves rows and constraints; adds a bulk `UPDATE` to every delete path and splits the id across two columns.
3. Drop the constraints, keep the indexes. Preserves rows and ids; loses referential checking on tables that are append-only.

Decision: option 3 for every log-table column that references `course`, `role`, or
`assignment`. Audit rows are exactly the rows that must outlive their subject, and
none of these tables is ever updated after insert. The `subject_id` and
`authorizer_id` references to `user` stay because users are not deleted.

`submission_log` keeps its constraints. It is not an audit table; it is student
activity data, and the existing delete paths (`Assignment.remove`,
`Submission.delete_completely`) already clear it deliberately.

---

## 6. Order of work and checkpoints

| Step | Phase | Gate |
|---|---|---|
| 1 | Phase 1 | Course suite green, new `TestPhase1Fixes` green |
| 2 | Phase 2 | All tests in 4.2 green |
| 3 | Phase 3 SQL run against a production copy, then production | `\d` confirms constraints gone; then deploy step 2 |
| 4 | Phase 3 pragma in `conftest.py` | Suite green or failures explicitly triaged |
| 5 | Phase 4 | Assignment log tests green |
| 6 | Phase 6a | Admin can list every log table |
| 7 | Phase 6b and 6c | Audit page tests green; feed checked against a production copy for speed |
| 8 | Phase 5 | Error log tests green; a deliberate exception on staging shows up on `/audit/errors` |
| 9 | Phase 7 | Docs in place |

Steps 1 and 2 can be merged to `master` before step 3 runs, as long as the deploy
waits: the `DELETE` and `REMOVED` writes fail on Postgres until the constraints are
dropped, and every other write is safe today.

---

## 7. Decisions

All three open questions were answered by the owner on 2026-09-13 and are folded into
the phases above. Recorded here so the reasoning is not lost:

1. **Error log: yes, via a lazy `access_log` row.** An email handler on the root logger was discussed as the cheaper way to learn that something broke. It is not the direction being taken; the database view is the design. Phase 5.
2. **CLI course deletions log with subject 1.** Phase 2, item 13.
3. **Instructors see their own courses' history.** Course and assignment history pages are open to instructors of the owning course; the dashboard, global feed, user history, and errors stay admin only. Phase 6d.
