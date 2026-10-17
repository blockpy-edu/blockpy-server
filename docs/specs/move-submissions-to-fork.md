# Moving student work onto a fork

Status: proposal, not scheduled. Written 2026-09-13 when the broken
`transfer_submissions` option was removed from `blockpy.fork_assignment`
(see `audit-logging-followup-bugs.md`, B5).

## The situation it serves

An instructor is running a course on an assignment they do not own (adopted from a
template course, or simply reused by id). Students have started it. The instructor
now needs to change the problem: fix a bug in the instructions, tighten the grader,
add a starting file. They cannot edit the original, so they fork it. The fork is a
new assignment with a new id, and every existing submission still points at the old
one. Today the only way forward is to ask students to start over, or to edit the
original and affect every other course using it.

The screen lets the instructor move the existing submissions in *their* course from
the source assignment to the fork, in one action, with the consequences spelled out.

## Scope

- One source assignment (or one group, applied per member) and one fork of it, in one
  course. The instructor must instruct the course; the fork must be owned by that course
  and have `forked_id` equal to the source.
- Only submissions whose `course_id` is that course. Other courses using the source are
  untouched.
- Moves, not copies. A submission ends up attached to exactly one assignment.

## What "move" changes

For each submission in the course on the source assignment:

| Column / table | Change |
|---|---|
| `submission.assignment_id` | the fork's id |
| `submission.assignment_version` | the fork's current `version` |
| `submission.assignment_group_id` | the group the fork sits in, if the source's group was forked too; otherwise unchanged |
| `submission_log` rows for the submission | `assignment_id` updated to the fork, so history stays attached (they are keyed by submission id and by assignment id) |
| `submission.endpoint`, `url`, `date_due`, `date_locked` | unchanged: the LMS still points at the same launch, which resolves by assignment id in the URL, see below |
| `review`, `grade_history`, `submission_counts` | unchanged: keyed by submission id |
| `sample_submission.forked_id` | unchanged |

Every move writes one `submission_log` row with `event_type="transfer"` (already a
`SubmissionLogEvent` member), `message` = JSON `{from: source_id, to: fork_id}`, and
one `assignment_log` row on the fork, `event_type="edit"`, `field="transferred_submissions"`,
`value` = the count, so the assignment history page shows when it happened.

**Launch URLs.** Canvas launches carry the assignment id or url in the query string
(`assignments/load?assignment_id=...`). After a move, students launching from the old
LMS link still land on the *source* assignment and `load_or_new_submission` would
create a fresh, empty submission for it. The screen has to say this plainly and
offer the fork's launch URL to paste into the LMS. If `submission.endpoint` (the LTI
outcome URL) is kept, grades posted from the fork still reach the same gradebook
column, which is the point.

## The screen

Route: `/assignments/move_to_fork` (GET shows, POST performs), reachable from the
fork result dialog ("You forked *X*; 23 students in this course have submissions on
the original. Move them?") and from the assignment manager's menu on any assignment
that has a fork in the course.

Sections, top to bottom:

1. **Source and fork.** Names, ids, versions, when the fork was made, and a diff link
   to `/audit/assignment/<fork>` so the instructor can check the fork is what they
   think it is.
2. **What will move.** A table of the affected submissions: student, status, score,
   version, last activity. Rows are checkboxes, all on by default. Students who have
   already submitted to the fork (edge case: they opened it directly) are listed
   separately as conflicts and are never moved; the instructor resolves those by hand.
3. **What will not change.** The launch-URL warning above, with the fork's URL and a
   copy button. A line saying grades, reviews and history travel with the submission.
4. **Confirm.** A button labelled with the count ("Move 23 submissions"), disabled until
   the instructor ticks "I have updated the launch URL in the LMS, or will."

The POST re-validates everything (course, ownership, `forked_id`), performs the moves
in one transaction, writes the log rows, and redirects back with a flash listing how
many moved and how many conflicts were skipped.

## Permissions

`require_course_instructor(g.user, course_id)`, and the fork's `course_id` must equal
`course_id`. Being an instructor of the source's course is not required (that is the
whole reason for forking) and grants nothing extra.

## Out of scope

- Moving between courses (that is `bulk_transfer_course`).
- Merging a fork's changes back into the source.
- Automatically rewriting LMS links; BlockPy has no API access to the LMS for that.

## Tests

- Moving 3 of 4 submissions updates exactly those rows and their `submission_log`
  rows; the fourth is untouched.
- A submission already on the fork is reported as a conflict and not moved.
- A fork owned by another course, or an assignment that is not a fork of the source,
  is refused.
- A student in another course on the same source assignment is untouched.
- The `transfer` and `assignment_log` rows are written with the right ids and count.
