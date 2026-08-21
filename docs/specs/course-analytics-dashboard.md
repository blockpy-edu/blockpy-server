# Course Analytics Dashboard

A new instructor-facing page, linked from the grader dashboard, that turns the
`models/counters` data (especially `submission_counts`) into visualizations and
statistics so instructors can quickly get a handle on their students. It reuses
the fine-grained selection machinery built for the new View Submissions panel
(`submissions_filter`): user sets, assignment sets, display settings, and the
criteria search — but where View Submissions answers "show me these
submissions," Analytics answers "tell me what's going on."

This spec also covers the prerequisite refactor: extracting the submission
search helpers out of `controllers/endpoints/courses.py` into a shared module,
generalized so criteria can target submission, metric, **user, and assignment**
fields.

Performance is a first-class requirement. The existing `fake_dashboard` is the
cautionary tale: it hydrates every submission in the course through the ORM
(with joined users and assignments), fetches every counter row, and pivots it
all in Python inside the request. The design below never does whole-course
per-submission work on an interactive path — aggregation happens in SQL, and
per-submission detail is only fetched for an explicitly scoped drill-down.

---

## 1. The questions instructors ask

The design starts from concrete questions, grounded in how the Bakery
curriculum is actually structured: assignment groups are the meaningful unit
(one group per lesson/day, mixing readings-with-videos, quizzes, and
programming problems), and Bakery Exams are timed, passcode-protected groups
of programming problems. Questions are grouped by the scenario in which they
arise, and ranked, because some will be asked every week and some only a few
times a term.

### A. "Monday morning" — the weekly pulse (asked constantly, P1)

1. **Who needs my attention right now?** Which students have stopped making
   progress — incomplete work piling up, no recent activity, or lots of
   activity with nothing to show for it (high time / high errors / low
   completion)?
2. **How far along is the class on the current group?** For the lesson due
   this week: what fraction of students have started, run code, finished each
   assignment?
3. **Who hasn't even started?** Distinct from "struggling" — the fix is
   different (a nudge vs. help).
4. **When are students working?** Steadily through the week, or the night
   before the deadline? (Cramming predicts trouble on exams.)

### B. "Is my content working?" — curriculum questions (asked weekly-ish, P2)

5. **Which problems are taking students the longest?** Median time-on-task
   per assignment, compared against the other problems in the same group.
6. **Which problems generate the most struggle?** High syntax-error rates
   suggest students lack fundamentals or the starter code confuses them; high
   runtime/assertion-failure rates suggest the logic or the instructions are
   the problem. These are different fixes, so show them separately.
7. **Where do students give up?** Problems with many runs/edits but low
   completion — the "started but never finished" funnel.
8. **Are students actually doing the readings and watching the videos?**
   Near-zero active read time or watch time on a reading, followed by
   struggle on the day's problems, is a story instructors want to see.
9. **How many attempts does a typical student need?** Per problem, what does
   the distribution of runs/edits look like?
10. **Which quiz questions are broken or mis-calibrated?** Per-question
    difficulty and discrimination, and which wrong answers students actually
    choose — BlockPy already computes this (`data_formats/quiz_analysis.py`
    via the `quiz_report` task); it needs to be surfaced here instead of
    living only in a buried static report (§4.4).

### C. "Tell me about this student" — office hours & advising (P3)

11. **What is this student's overall picture?** Completion, scores, total
    time invested, across every group — one screen before a meeting.
12. **What kind of struggle is it?** A per-student error profile: mostly
    syntax errors (fundamentals), mostly runtime errors, or mostly failing
    instructor tests (logic/spec reading)?
13. **Is their time investment reasonable?** Are they spending 3× the class
    median to get the same results (working hard but stuck), or barely any
    time (disengaged)?
14. **Do they cram?** Mean work-moment relative to the deadline, per group.
15. **Anything anomalous?** Heavy pasting, emoji-laden code (a signature of
    LLM-generated code — see §2), or big discrepancies between homework and
    exam performance.

### D. "Exam day and the week after" — Bakery Exams (seasonal, high stakes, P4)

16. **During the exam: who is stuck?** Live-ish view of progress per student
    per problem (the Watcher partially covers "live"; this page covers the
    retrospective).
17. **How did students spend their limited time?** Time used vs. the time
    limit; which problem consumed the most time; who ran out of time with
    problems unstarted.
18. **Which exam problems were hardest?** Same difficulty metrics as (B), but
    scoped to the exam group and compared against homework versions of the
    same skills.
19. **Are there integrity signals worth a closer look?** Window visibility
    changes (tabbing away), paste counts, and emoji counts (LLM-generated
    code tends to contain emoji, which students rarely type themselves)
    during a timed exam; exam scores far above a student's homework baseline.
    **These are signals, never verdicts** — the UI must present neutral
    counts ("42 tab switches, class median 6"), not accusations, and must
    make it one click to open the actual submission history for human
    judgment.

### E. Questions we *cannot* answer well yet (name them so nobody expects them)

- Code quality / concept mastery — nothing in the counters reads the code.
- Collaboration detection beyond paste/emoji counts.
- Anything about students who never generate events (counters only exist once
  a submission has activity — see §2, "absence of data").

---

## 2. What the data can answer

### Per-submission raw metrics (`SubmissionCounts`, pivoted by `metric`)

| Metric | Meaning | Unit / caveat |
|---|---|---|
| `total_time_spent` | Sum of between-event gaps, capped at 5 s/event | Seconds; a **floor estimate** of engaged time |
| `total_edits` / `total_edit_time` | Edit count / **sum of epoch timestamps** of edits | Divide time by count → *mean moment of editing* (a datetime, not a duration) |
| `total_interventions` / `total_intervention_time` | Feedback-run count / sum of epoch timestamps | Same timestamp-sum semantics |
| `feedback_total` | Feedback events generated | ≈ interventions |
| `feedback_syntax_errors` | Runs ending in a syntax error | Count |
| `feedback_runtime_errors` | Runs ending in a runtime error | Count |
| `feedback_assertion_counts` / `_successes` | Instructor-test assertions run / passed | Counts across all runs |
| `feedback_assertion_feedbacks` / `_feedback_successes` | Same, for feedback-style assertions | Counts |
| `total_read_time` / `total_active_read_time` | Reading time / reading time with mouse movement | **Milliseconds** |
| `total_watch_time` | Video watch time | **Milliseconds** |
| `pastes` | Paste events into the editor | Count; integrity signal |
| `window_visibility_changes` | Tab-away / tab-back events | Count; integrity signal |
| `emojis` | Emoji characters seen in edited code | **Integrity signal: emoji in code is a signature of LLM-generated code.** Accumulated per edit (the same emoji is re-counted on every subsequent edit), so treat it as ordinal — "some vs. lots" — not an exact count |

### Per-submission columns already on `Submission`

`score`, `correct`, `submission_status`, `grading_status`, `version`,
`attempts`, and the date columns (`date_started`, `date_submitted`,
`date_due`, `date_modified`, …) — the analytics detail payload extends the
existing `encode_submission_for_filter` encoding rather than inventing a new
one.

### Derived metrics (defined once, in one module — see §3 and §5)

- **Syntax error rate** = `feedback_syntax_errors / feedback_total`
- **Runtime error rate** = `feedback_runtime_errors / feedback_total`
- **Assertion success rate** = `feedback_assertion_successes / feedback_assertion_counts`
- **Estimated time on task** = `total_time_spent` (shown as "≥ 24 min" to be
  honest about the floor-estimate semantics)
- **Mean work moment** = `total_edit_time / total_edits` → datetime; and
  **deadline lead** = `date_due − mean work moment` (negative = worked after
  due). This is the cramming detector, and it falls out of data we already
  have.
- **Edits per run** = `total_edits / total_interventions` (thrashing detector:
  very low = run-spamming, very high = long silences between feedback)
- **Time used (exams)** = `last activity − date_started`, vs. the group's
  time limit.

These generalize `compute_special_metrics` in `courses.py` (used by
`fake_dashboard`), which should be treated as the prototype this page
replaces.

### The two data honesty rules

1. **Absence of data ≠ zero.** A submission with no counter rows (created
   before the counters existed, or a student who opened nothing) must render
   as "—", never as "0 minutes, 0 errors". Every aggregate states its *n*
   ("median of 41 students with data").
2. **Type-aware metrics.** Readings get read/watch columns; quizzes get
   score/attempts/item analysis; programming (blockpy/python/java/
   typescript/maze) gets time/edits/errors/assertions. Showing "syntax error
   rate" for a reading is noise. The assignment `type` column drives which
   metric set each row shows.

### The other counter tables: what to use, what to add

`models/counters` defines three aggregate tables beyond `SubmissionCounts` —
`CourseCounts`, `AssignmentCounts`, `UserCounts` — none currently exported
from the package or maintained. Two more (`enrollment_counts`,
`group_counts`) existed at some point and were removed. Assessment against
this dashboard's needs:

The dashboard's two hot aggregation grains are **(course × assignment)** and
**(course × user)**. None of the existing tables has either grain:
`AssignmentCounts` is per-assignment *globally* — and Bakery assignments are
shared across many course instances, so a global rollup mixes semesters
together — and `UserCounts` is per-user globally. So the honest ranking is:

1. **Add `enrollment_counts` back (course_id × user_id × metric)** — the
   single highest-value counter for this page. EAV-shaped like
   `SubmissionCounts`. Metrics: summed `total_time_spent`, `feedback_*`
   sums, count of correct/started/submitted submissions, and
   `last_activity` (as an epoch, maintained with `safely_max`). This powers
   the Students roster, the Overview "needs attention" / "not started" /
   "active in the last 7 days" computations with a single small query.
2. **Add a course-scoped assignment rollup (course_id × assignment_id ×
   metric)** — same shape; powers the Assignments table's default columns
   (rates and means come from summed numerators/denominators plus *n*).
3. **`CourseCounts` (exists)** — switch it on for the Overview tiles and the
   course pickers (`total_students`, `date_last_submission`, …). Cheapest
   win, shallow value.
4. **`AssignmentCounts` (exists)** — `total_submissions` /
   `date_last_submission` are still useful for staleness labels and for
   ordering assignment pickers by recent activity; just don't use it for
   per-course statistics (wrong grain).
5. **`UserCounts` (exists)** — `last_logged_in` / `last_edited` are marginal
   here (enrollment-level `last_activity` supersedes them for instructors);
   defer.

**Maintenance strategy — keep the event hot path untouched.**
`SubmissionCounts.track_event` runs on every logged event and is already
performance-sensitive (there's a disabled branch in it "due to performance
concerns"). Do not add more upserts there. Instead, a scheduled huey task
(`refresh_course_analytics(course_id)`) folds `submission_counts` +
`submission` into the two rollup tables with a `date_modified` watermark —
run every ~15 minutes for courses with recent activity, plus on-demand from
the page's Refresh button. The UI always displays freshness ("as of 14
minutes ago"). Medians and distributions cannot be maintained incrementally;
they come from the scoped SQL paths in §4, which is fine because they're only
needed for drill-downs and current-group views.

---

## 3. The interface

### Entry points

- New route `courses/analytics/<course_id>` (grader-only, same guard as
  `submissions_filter`), rendered by `templates/courses/analytics.html`.
- A new card on the grader dashboard ("Course Analytics — charts and
  statistics about how your students are doing"), with the same
  relaunch-in-window handling as the other cards, plus a
  `grade_mode='analytics'` passthrough in `assignments.py` mirroring
  `'filter'`/`'watch'`.
- Cross-links both ways: every table row / chart point links into View
  Submissions (or a specific submission) pre-filtered to the same users +
  assignments via the existing `user_ids`/`assignment_ids`/`criteria` URL
  parameters; View Submissions gets a small "Analyze these" link back.

### Shared controls (the fine-grained part, identical to View Submissions)

One control bar at the top applies to **every** tab:

- **User selector** (`model_selector`: All / Only / Set, saved user sets,
  display settings for name rendering/sorting).
- **Assignment selector** (same component, grouped by assignment group).
  Default on load: *the most recent assignment group with student activity*,
  not the whole course — this keeps first paint fast and matches "how is the
  current lesson going," the most common question.
- **Criteria search** — the same search builder, extended (see §5) with
  metric, user, and assignment fields, so instructors can express things
  like `total_time_spent > 3600 AND correct = false`,
  `user.email icontains "@udel.edu"`, or `assignment.type = reading`.
  Every filter narrows every chart.

Selections persist in the URL (shareable with co-instructors/TAs) exactly as
View Submissions does.

### Tab 1 — Overview (default): the pulse

Answers A1–A4 at a glance. Deliberately small: four stat tiles and two lists,
all served from the rollup tables (§2) — no per-submission work.

- **Tiles:** students active in the last 7 days (of enrolled learners) ·
  completion of the selected group (median % of assignments completed) ·
  median time on the selected group · submissions pending manual review
  (links to the grading queue).
- **Needs attention** list: students flagged by *transparent, named rules* —
  each row shows the reason as a plain sentence, e.g. "No activity in 9
  days", "12 h on this group, 1/6 complete", "Syntax error rate 78% (class
  median 22%)". Rules are simple threshold checks defined in one frontend
  module; no scores, no black box. Each row links to that student's tab-3
  detail.
- **Not started** list: enrolled learners with no submissions in the selected
  assignments.

### Tab 2 — Assignments: is the content working?

Answers B5–B10. A table, grouped by assignment group (bakery day), one row
per assignment, with type-aware columns:

- Programming rows: started / ran / correct funnel counts, completion %,
  median score, median time (floor), median runs, syntax %, runtime %,
  assertion success % — the error columns rendered as small inline bars so
  outliers pop without reading numbers.
- Reading rows: % of students with any read time, median active read time,
  median watch time vs. video length.
- Quiz rows: completion %, median score, median attempts, and — when a quiz
  analysis exists — worst question difficulty and lowest discrimination as
  at-a-glance flags.

Sortable, like the View Submissions table. Clicking a row expands an
**assignment detail** panel, fetched on demand for that assignment only:

- Programming detail: histogram of time-on-task, histogram of runs,
  score-vs-time scatter (each dot a student, linking to their submission).
  This is where "is this problem too hard or too long" gets settled.
- **Quiz detail (item analysis)**: rendered from the quiz analysis data
  (§4.4) — a difficulty × discrimination scatter of the questions (the
  classic item-analysis quadrant: bottom-left = hard *and*
  non-discriminating = probably broken), and per-question expanders showing
  the answer distribution (each answer's overall / initial / final selection
  rates and its binomial confidence interval, from `per_part_stats`).
  A "Run quiz analysis" / "Refresh (analysis from Oct 3)" button enqueues
  the existing `quiz_report` task and polls the report status — the
  computation re-grades every submission and must never run in-request.

### Tab 3 — Students: the roster and the individual

Answers C11–C15. Two levels:

- **Roster table** (from `enrollment_counts`): one row per student,
  aggregated over the selected assignments: completion %, mean score, total
  estimated time, syntax / runtime / assertion rates, last activity date,
  median deadline lead ("works 2.1 days early" / "works 3 h late"). Columns
  sortable; rates colored against the class median, not absolute thresholds.
- **Student detail** (click a row; scoped fetch for one student): a
  per-group progress strip across the whole course (one cell per assignment,
  colored by status — the "one screen before office hours" view), the
  student's time per group plotted against the class median, their error
  profile, their work-timing pattern, and an anomalies line (pastes, emojis,
  exam-vs-homework gap) when any are elevated. Prominent links to
  `submissions_user` and View Submissions filtered to them.

### Tab 4 — Exams: Bakery Exam review

Answers D16–D19. Scoped to one assignment group at a time; the group picker
lists timed groups first (discovered via `Assignment.get_timed_assignments()`
membership, the same logic `manage_time` uses). One exam group is small
(students × ~4 problems), so this tab uses the per-submission detail
endpoint directly.

- **Time usage**: per student, a horizontal bar from `date_started` to last
  activity against the time limit (extensions from `time_limit` overrides
  shown); flags "ran out of time with N problems unstarted".
- **Problem difficulty**: the tab-2 table scoped to the exam, so the hardest
  exam problem is obvious.
- **Signals** table: per student — window visibility changes, pastes, emoji
  counts, exam score vs. their homework mean (homework baseline from
  `enrollment_counts`). Sorted neutrally by name by default; each row links
  straight to the submission's code history. Neutral language throughout
  ("signals to review", never "cheating"); class medians shown next to every
  count so "42" has context.

### Charts: Chart.js

Use a real charting library rather than hand-rolling SVG. Recommendation:
**Chart.js v4** —

- Canvas-based and fast at this page's scale (hundreds of points).
- First-party TypeScript types, zero runtime dependencies, tree-shakeable
  registration (register only bar/scatter/line controllers → small bundle
  addition in the webpack build).
- Framework-agnostic, so it wraps cleanly in a Knockout custom binding.
- Covers every shape this page needs natively: histograms (bar over
  pre-binned data), inline horizontal bars, scatter, time-usage stacked
  horizontal bars, progress strips (matrix via `chartjs-chart-matrix`, or a
  plain HTML grid — decide during build).
- `chartjs-plugin-annotation` draws the class-median reference lines.

(Apache ECharts is the fallback if we hit a wall — more powerful, notably
heavier. Plotly is out: ~3 MB for four chart shapes.)

Integration: `frontend/components/analytics/charts.ts` registers the needed
controllers once, defines the shared palette / fonts / number-and-duration
formatters, and exposes a `ko.bindingHandlers.chart` binding that creates,
updates (on observable change), and disposes the Chart instance. Components
never import Chart.js directly — one seam, consistent styling.

---

## 4. Backend

### 4.1 Why `fake_dashboard` is slow, and the rules that follow

`fake_dashboard` = full ORM hydration of every course submission (joined to
users and assignments) + every counter row for the course + a Python pivot +
rendering, all in one request. Rules for the new endpoints:

1. **Aggregate in SQL, not Python.** Interactive tables and tiles are served
   by `GROUP BY` queries or the rollup tables — payloads are one row per
   assignment or per student, never per submission.
2. **Per-submission data only when scoped.** The detail endpoint requires an
   explicit scope (one assignment, one student, or one exam group) and uses
   the plain-tuple/deferred-column patterns already proven in
   `Course.get_submission_counts` and `submissions_filter_data` — no full
   entity hydration, batch-prefetched relations held in locals so the
   identity map keeps them.
3. **Expensive computation goes to huey.** Rollup refresh and quiz analysis
   are background tasks; requests only read their results.
4. **Postgres does the statistics.** Medians/quartiles via
   `percentile_cont` in the grouped queries (SQLite dev fallback: compute in
   Python — dev datasets are small).

### 4.2 Interactive endpoints (in `controllers/endpoints/courses.py`)

- `courses/analytics/<course_id>` — page route; mirrors `submissions_filter`
  exactly (grader guard, embedded users + grouped assignments so selectors
  populate instantly).

- `courses/analytics/rollup` (`course_id`, optional `assignment_ids`,
  `user_ids`) — one row per assignment and one per student for the
  selection: submission-status funnel counts, score stats, metric sums and
  *n*s (from the rollup tables when fresh, or the equivalent `GROUP BY
  submission_counts.metric` query — same payload either way, so phase 1 can
  ship on live `GROUP BY` and materialize later only if measurements demand
  it). Includes a `data_as_of` timestamp. Powers tabs 1–3's tables.

- `courses/analytics/detail` (`course_id` + a required scope:
  `assignment_ids` *or* `user_ids` *or* an exam `assignment_group_id`, with
  a server-enforced cap on scope size) — per-submission rows in the
  `encode_submission_for_filter` shape plus `date_started`, `date_due`,
  `attempts`, and a `metrics` dict pivoted from the counters. Metrics with
  no row are **omitted**, not zero-filled — that's how the frontend tells
  "no data" from zero. Accepts the same `search` criteria as View
  Submissions (evaluated server-side per §5). Powers drill-down panels and
  the Exams tab.

Criteria search interacts with the two modes simply: criteria apply on the
detail path (where per-submission evaluation is possible); when criteria are
active, tables for the *current scope* are computed client-side from the
filtered detail payload, and the UI keeps scopes modest (the selector warns
before an unscoped criteria search of the whole course).

### 4.3 Rollup maintenance

`tasks/refresh_course_analytics(course_id)` (huey): folds `submission` +
`submission_counts` into `enrollment_counts` and the course-scoped
assignment rollup, watermarked on `Submission.date_modified`; scheduled for
courses with activity since the last run, and enqueued by the page's Refresh
button (debounced server-side). Also the natural place to maintain
`CourseCounts`.

### 4.4 Quiz analytics integration

The machinery exists: `models/data_formats/quiz_analysis.py:process_quizzes`
computes per-question difficulty, discrimination (vs. quiz score), and
per-answer distributions with binomial confidence intervals, and the
`quiz_report` huey task already runs it per assignment and renders a static
HTML report. Integration plan:

1. **Make the output machine-readable.** `quiz_report` additionally writes
   `stats.json` next to `index.html`: per question — id, body (rendered),
   type, points, difficulty, discrimination, and `per_part_stats` (answer →
   count, rate, confidence interval). Old reports without `stats.json`
   simply don't render in the dashboard (link to their HTML instead).
2. **Serve it.** `courses/analytics/quiz/<assignment_id>` returns the latest
   *finished* `quiz_report` for that assignment in this course
   (`Report.by_course(course_id, "quiz_report")`, newest matching
   assignment): `{report_id, date_finished, questions: [...]}` — or
   `{report_id: null}` meaning "not yet analyzed". A `POST` with
   `action=refresh` enqueues the task (reusing the existing
   `controllers/quizzes` launch path and its permission checks) and returns
   the task/report id for polling.
3. **Render it** in the Tab 2 quiz detail panel (§3). The existing
   `courses/quizzes` page stays as the power-tool (cross-course reports,
   regrading options); the dashboard is the everyday view.

This keeps the expensive re-grading fully out of the request path while
finally making item analysis visible where instructors already are.

### 4.5 Retirement

`fake_dashboard`'s json/html/summary modes are superseded by this page; keep
only its CSV export — reimplemented on the `detail` endpoint's query pattern
(the current implementation is the slow one) and exposed as a "Download CSV"
button, since instructors doing their own analysis in Excel/pandas is a real
use case. `compute_special_metrics`/`SPECIAL_METRICS` move into the shared
derived-metrics definitions.

---

## 5. Refactor: the submission search module

Currently `controllers/endpoints/courses.py` (already ~1500 lines) holds the
whole search engine. Extract to a new **`controllers/submission_search.py`**
(sibling of `controllers/helpers.py`).

### Step 1 — move, no behavior change

Moves verbatim: `VALID_SEARCH_FIELDS`, `parse_submission_search`,
`_search_compare_numbers`, `_search_compare_text`, `_search_compare_date`,
`evaluate_search_criterion`, `matches_search_criteria`,
`encode_submission_for_filter`, and the needs-code/needs-feedback defer
logic (as `search_load_options(criteria)`). `courses.py` keeps only the
routes. The existing View Submissions page is the regression test.

### Step 2 — a field registry with four namespaces

Replace the flat `VALID_SEARCH_FIELDS` set with a registry mapping field name
→ spec (category, value-getter, comparison type, allowed operators):

- **Submission fields** (unprefixed, exactly today's set — existing saved
  criteria keep working): `score`, `correct`, `code`, `date_modified`, …
- **Metric fields** (every `SubmissionMetrics` value plus the derived
  rates): numeric comparison against the pivoted metrics dict, passed in as
  `evaluate_search_criterion(submission, criterion, metrics=None)`. Absent
  metric = criterion fails, consistent with "no data ≠ 0".
- **User fields** (`user.name`, `user.email`): text comparison against the
  submission's user.
- **Assignment fields** (`assignment.name`, `assignment.url`,
  `assignment.type` (select), `assignment.group` (text match on group
  name), `assignment.reviewed` / `assignment.hidden` (boolean)): compared
  against the submission's assignment.

`parse_submission_search(raw, allowed_fields)` takes the allowed registry
subset per endpoint, so View Submissions opts into user/assignment fields
deliberately (it should — "search by student name" is an obvious win there)
and its accepted set never grows silently.

Evaluation performance: user/assignment fields read relationship attributes,
so both endpoints batch-prefetch the users and assignments for the candidate
submissions before the evaluation loop (assignments are already prefetched;
add the users), held in locals for the identity map. `search_load_options`
grows the same awareness: criteria on `code`/`code_length`/`feedback` are
what un-defers those columns.

### Frontend counterpart

The search-builder UI (field specs + criteria editor) currently lives inside
`submissions_filter.ts`; lift it to `frontend/components/search_criteria.ts`
so the analytics page reuses the editor with the extended field list
(grouped in the field dropdown by namespace: Submission / Metrics / Student
/ Assignment) instead of forking it.

---

## 6. Build order

1. **Refactor first** (§5 step 1, moves only) — lands independently, shrinks
   `courses.py`, zero user-visible change.
2. **Search registry + user/assignment/metric fields** (§5 step 2), landing
   the user/assignment fields in View Submissions immediately.
3. **Rollup + detail endpoints, page shell, Tab 2 table** (no charts yet) —
   rollup served by live `GROUP BY` initially; measure before materializing.
4. **Chart.js + charts module**, then Tab 2 drill-downs and Tab 3
   roster/detail.
5. **Rollup tables + refresh task** (`enrollment_counts`, assignment×course
   rollup, `CourseCounts`) once step 3's measurements say which queries need
   them; then **Tab 1 (Overview)**, whose needs-attention thresholds are
   calibrated against the real distributions now visible.
6. **Quiz analytics integration** (§4.4): `stats.json`, the serve/refresh
   endpoint, the item-analysis panel.
7. **Tab 4 (Exams)** — in time for the next Bakery Exam; it reuses
   everything above plus the time-limit lookup.
8. Retire `fake_dashboard` modes; move its CSV export onto the new page.

## 7. Out of scope

- Live/streaming updates (the Watcher's job; this page is retrospective —
  a manual refresh button suffices).
- New event tracking in `track_event` (works with what it already records;
  rollups are maintained off the hot path).
- Grade *changing* of any kind — this page is read-only; it links to the
  grading tools rather than embedding them.
- Predictive/ML risk scoring — the needs-attention list is explicit
  threshold rules with visible reasons, by design.
- Replacing the `courses/quizzes` report tool — the dashboard surfaces its
  results; cross-course and regrading workflows stay there.
