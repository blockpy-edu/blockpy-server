# Changelog

All notable changes to BlockPy Server are recorded in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(`MAJOR.MINOR.PATCH`): a new feature raises the minor number, a release of
fixes only raises the patch number, and a change that people running the
server must act on raises the major number.

Changes collect under "Unreleased" until they are released, and then move under
a heading with the version and its release date (`YYYY-MM-DD`), newest first.
Version tracking starts at 6.5.0; changes made before it are in the git
history.

Each entry says what changed for the people who use or run the server. Entries
are grouped as Added, Changed, Deprecated, Removed, Fixed, or Security.

## [Unreleased]

### Fixed

- Applying a score adjustment failed on the production database with
  `type "reviewcommentformat" does not exist`, and nothing was saved. Enum
  columns were declared as native Postgres enum types, which production does
  not have (it stores them as `VARCHAR`). That only matters when several rows
  are inserted in one statement, as applying an adjustment does. Every enum
  column is now declared as `VARCHAR`, so the same failure cannot occur on the
  other tables that have one.

## [6.5.0] - 2026-11-15

### Added

- **Score Adjustments** page (`grading/adjustments`) for correcting many
  students' scores on one assignment at once, in every course that uses it.
  Each adjustment adds a review to the chosen submissions, so it shows up and
  counts exactly like a review written by hand.
  - Choose students by how they answered a quiz question, by the variation of a
    pooled coding problem they were given, and by search conditions such as
    score or number of graded attempts.
  - Give or remove credit for a quiz question (the points are worked out per
    student), or add a fixed amount, raise scores to a floor, or set an exact
    score. Scores are kept within 0–100%.
  - Preview every matching submission with its score now and after, choose
    rows individually or with Select all, and sort by any column, before
    anything is saved.
  - Edit or remove an adjustment later. Reviews that a grader has since edited
    by hand are kept and flagged rather than overwritten.
  - Send the new grades to the LMS as a separate step. Sending posts the
    current total only: it does not regrade the submission or end a quiz
    attempt.
  - Reached from the course page, from Quiz Analysis (per assignment and per
    question), and from the submissions filter.
  - No database migration is needed.
- "Times graded" condition for submission searches: how many times a
  submission was run for a grade, or a quiz was submitted.

### Changed

- A review can inherit its comment and score from a shared parent review that
  is not in the sitewide "Inherit from" list. The review editor shows the
  inherited text and score for these reviews.
- Course-wide grade calculations load a parent review shared by many
  submissions once, instead of once per submission.
- Frontend: the review interface moved from `review_interface.ts` into
  `frontend/components/review/`, one file per component. No change in
  behaviour.
