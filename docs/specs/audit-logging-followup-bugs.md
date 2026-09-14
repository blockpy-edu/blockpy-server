# Pre-existing bugs found while building audit logging

Status: for review. Nothing here is implemented; each item has a proposed fix and a
decision line to fill in. Found 2026-09-13 on the `audit-logging` branch, at
`dacbbb1e`. None of these are caused by the audit work; they were in the way of it.

Two kinds of evidence appear below. "Enforced" means the failure was produced by the
test suite with `BLOCKPY_TEST_FOREIGN_KEYS=1`, which makes SQLite behave like
production Postgres on foreign keys. "Observed" means the endpoint failed outright
in the normal suite.

---

## B1. Removing an assignment group deletes the group before its memberships

**Where:** `AssignmentGroup.remove` (`models/assignment_group.py`)

**Symptom:** With foreign keys enforced, `POST /assignment_group/remove` fails with
`FOREIGN KEY constraint failed`. The method deletes the `assignment_group` row and only
then the `assignment_group_membership` rows that point at it. Postgres rejects the
first delete, so in production the endpoint either 500s or leaves the group in place.
(Enforced: `test_remove_group_instructor_allowed`.)

**Proposed fix:** Swap the two deletes so memberships go first.

```python
        # Delete target
        models.AssignmentGroupMembership.query.filter_by(assignment_group_id=assignment_group_id).delete()
        AssignmentGroup.query.filter_by(id=assignment_group_id).delete()
        db.session.commit()
```

Submissions carry `assignment_group_id` too. Those are not cleared today either; the
same fix should null them (`Submission.query.filter_by(assignment_group_id=...).update({"assignment_group_id": None})`)
so a submission never points at a missing group. Removing a group already leaves its
assignments behind on purpose.

**Test:** the existing removal test passes with `BLOCKPY_TEST_FOREIGN_KEYS=1`; add an
assertion that a submission in the group has `assignment_group_id` set to `None` after.

**Decision:** ______

---

## B2. Removing a course leaves everything that pointed at it

**Where:** `Course.remove` (`models/course.py`), called from `courses.remove_course`
with `remove_linked=False` and from the `delete_course` CLI with `remove_linked=True`

**Symptom:** The web path deletes only the `course` row. Roles, assignments, groups,
memberships, submissions, submission logs, invites and reports keep their `course_id`.
With foreign keys enforced the delete is rejected (Enforced: `test_remove_logs_delete`).
Without enforcement it succeeds and leaves orphans; the Flask-Admin user list already
has a "Missing course?" fallback for exactly that. The CLI path with `remove_linked`
deletes memberships, assignments, groups and roles but still not submissions,
submission logs, invites or reports, so it fails the same way on any course that was
ever used.

**Proposed fix:** Decide what course deletion means, then make one path do it.

Option A, the conservative one: forbid deleting a course that has submissions, and
make the delete complete for the rest. `Course.remove` deletes, in order, submission
logs and submissions (only when `remove_linked`), memberships, invites, reports, roles,
groups, assignments, then the course. The endpoint refuses with a message when
submissions exist and `remove_linked` is false, and points the admin at archiving
(visibility `archived`) instead.

Option B: never delete, only archive. Remove the endpoint and the CLI command, keep
`Course.remove` for tests.

I would take Option A. Archiving already exists, and an admin who really wants a course
gone can use the CLI with `--remove-linked` once it works.

**Test:** with `BLOCKPY_TEST_FOREIGN_KEYS=1`, delete a course that has a role, a group
with a membership, and an invite; assert no row anywhere references its id. Assert the
endpoint refuses a course with submissions.

**Decision:** ______

---

## B3. Adding a brand-new user through "Add users" crashes on the password column

**Where:** `courses.add_users` (`controllers/endpoints/courses.py`), the
`current_app.user_datastore.create_user(...)` call

**Symptom:** For an email that does not exist yet, the datastore builds a `User` with no
password, and `user.password` is `NOT NULL`, so the insert fails with an
`IntegrityError` and the request 500s. Existing users are added fine. (Observed: the
first draft of `test_add_users_logs_given` used a new email.) If production still has
users created this way, the column there must be nullable or the code path has never
been exercised for new emails; either way the model and the form disagree.

**Proposed fix:** Give new users an unusable password and rely on the reset flow, which
is what the `# TODO: Send an email to reset their password` comment next to it intends:

```python
                new_user = current_app.user_datastore.create_user(
                    first_name=first_name, last_name=last_name, email=new_email,
                    password=hash_password(uuid.uuid4().hex),
                    confirmed_at=datetime.now(timezone.utc))
```

`User.new_from_instructor` has the same gap when `password` is `None`; give it the same
default.

**Test:** `POST /courses/add_users/6` with a new email creates the user, gives the role,
and logs `GIVEN`; the user cannot log in with an empty password.

**Decision:** ______

---

## B4. Transferring a submission between courses collides on the unique `url`

**Where:** `Submission.copy_from` (`models/submission.py`), used by
`assignments.transfer_course` and `assignments.bulk_transfer_course`

**Symptom:** `copy_from` copies `url` from the old submission to the new one, but
`submission.url` is unique, and the old submission still has it. Both transfer
endpoints fail with a `UNIQUE constraint failed: submission.url` `IntegrityError` for
any submission whose `url` is set, which `Submission.load_or_new` sets for every new
submission. (Observed: `test_bulk_transfer_logs_both_courses` has to null the source
url to get through.)

**Proposed fix:** Stop copying `url`. It identifies the submission, it is not content.
The new submission already has its own from `load_or_new`. `endpoint` (the LTI outcome
URL) is the field that is meant to be carried over, and `copy_from` already handles
that with `overwrite_endpoints`.

```python
    def copy_from(self, old_submission, overwrite_endpoints=False):
        self.code = old_submission.code
        self.extra_files = old_submission.extra_files
        # url is this submission's own identity and is unique; it is not copied
        if overwrite_endpoints or not self.endpoint:
            self.endpoint = old_submission.endpoint
```

If `url` was being copied so that an LTI launch keyed on it finds the moved
submission, that lookup should be checked before this change; I did not find a
lookup by `url` outside `load_or_new`.

**Test:** transfer a submission that has a url; the new submission exists, keeps its own
url, and has the old code. Drop the `submission.url = None` line from the audit test.

**Decision:** ______

---

## B5. `blockpy.fork_assignment` cannot transfer submissions

**Where:** `controllers/endpoints/blockpy.py`, the `transfer_submissions` branch of
`fork_assignment`

**Symptom:** The loop looks up `Submission.by_assignment(new_assignment.id, course_id)`,
which is the *new* assignment and has no submissions yet, then calls `.edit` on the
result, which is `None`, so `transfer_submissions=true` always raises
`AttributeError`. The `# TODO: Need old assignment IDs` comment says as much. Nothing in
the frontend sends `transfer_submissions`, so this is dead but reachable.

Phase 1 also changed what this endpoint does with `updated_settings`: it used to apply
them to the *source* assignment (which the caller may not own) and crashed anyway
because it passed a string to `Assignment.edit`. It now applies them to the forked
copy. That is a behavior decision worth confirming.

**Proposed fix:** Either finish it or remove the parameter. To finish it: iterate over
`zip(old_assignments, new_assignments)`, move each submission in `course_id` from the
old id to the new id with `submission.edit({'assignment_id': new.id})`, and log a
`SubmissionLog` `transfer` event per submission. To remove it: drop the
`transfer_submissions` parameter and the loop.

I would remove it. Adoption (the "Adopt Assignments" menu) is the supported way to reuse
an assignment without copying, and moving student work onto a fork is a grading
decision that deserves its own screen.

**Test:** `POST /blockpy/fork_assignment` with `transfer_submissions=true` returns
success and, if kept, the submission's `assignment_id` changes.

**Decision:** ______

---

## B6. `Course.find_all_linked_resources` references a relationship that does not exist

**Where:** `models/course.py`, `find_all_linked_resources`

**Symptom:** The dictionary includes `"Log": self.logs`. `Course` has no `logs`
attribute (it has `course_logs`, `role_logs`, `assignment_logs`, `submission_logs`), so
the method raises `AttributeError`. It is called by the generic
`find_all_linked_resources` walker, which `clear_old_anonymous_users` runs over every
anonymous user; the walk reaches a course as soon as an anonymous user owns one, and the
whole command dies. (Observed by reading; not exercised by a test.)

**Proposed fix:** Replace the line with the four real relationships, using the category
names `mass_delete` already orders:

```python
            "SubmissionLog": self.submission_logs,
            "AssignmentLog": self.assignment_logs,
            "RoleLog": self.role_logs,
            "CourseLog": self.course_logs,
```

`SAFE_DELETE_ORDER` deletes those four before `Course`, so the cleanup then works.
Whether audit rows should be deleted with an anonymous user's course at all is a
policy question; since the whole point of that command is to erase anonymous data, I
would say yes.

**Test:** create a course owned by an anonymous user, log a course event on it, run the
walker; assert the graph contains the log row and `mass_delete` succeeds.

**Decision:** ______

---

## B7. Test harness: `act_as` cannot switch users within one test

**Where:** `tests/conftest.py`, the `act_as` fixture

**Symptom:** The fixture writes `_user_id` into the client session. The first call works.
A second call with a different user in the same test is ignored: requests keep running
as the first user. (Observed: several audit tests had to be restructured to log in
once.) Any test that "acts as Ada, then checks as admin" silently tests the wrong thing.

**Proposed fix:** Either clear the client's cookie jar and any cached identity before
setting the new user (`client.delete_cookie('session')` then re-set the session), or
have the fixture return a fresh `app.test_client()` per call. The second is simpler and
cannot leak state, but callers that hold the original `client` need to use the returned
one. Worth doing before more tests are written against it.

**Test:** act as Ada, request `/courses/`, act as admin, request `/admin/`; assert 200.

**Decision:** ______

---

## Already fixed on the branch (for awareness, not approval)

These were fixed in the audit commits because the logging could not be tested without
them. Listed so they can be reverted or reconsidered if any is unwelcome.

| Commit | Fix |
|---|---|
| phase 1 | `Role.update_role` referenced a nonexistent `CHOICES`; `/courses/change_role` always 500ed. |
| phase 1 | `Course.set_setting` built a `models.Log` that does not exist; corrupted settings crashed `edit_textbooks`. |
| phase 1 | `abort_with_failure(as_html=True)` aborted with a 2xx code, which Werkzeug cannot raise. Now 403. |
| phase 1 | `blockpy.fork_assignment` called `group.fork()` without arguments and edited an unbound variable in the group branch. |
| phase 2 | Course visibility was never applied on create or change: `isinstance(visibility.lower(), CourseVisibility)` is always false for a string. Every course created through the form was private. |
| phase 2 | `courses.change_role` reported success for unknown roles. |
| phase 2 | `tests/factory/data/role.csv` had no types row, so the loader ate the admin role (user 1 was never an admin in tests) and ids were loaded as strings. |
| phase 3 | The log relationships on Role, Course and Assignment now use `passive_deletes`; an ORM delete used to null out `role_log.role_id` and fail on `NOT NULL`. |
