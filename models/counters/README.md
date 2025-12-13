# Counts Tables Documentation

## Overview

The counts tables provide an efficient way to track usage statistics and metrics across the BlockPy server. Instead of querying historical log data every time statistics are needed, these tables maintain running sums, averages, and other aggregated metrics that are updated in real-time as events occur.

## Architecture

The counts system consists of four main tables:

### 1. SubmissionCounts
Tracks statistics for individual submissions.

**Fields:**
- `runs` - Number of times the submission has been run
- `average_edit_time` - Running average of time between edits (in seconds)
- `average_attempt_time` - Running average of time between submission attempts
- `estimated_time_spent` - Estimated total time spent on the submission
- `syntax_errors` - Count of syntax errors encountered
- `runtime_errors` - Count of runtime errors encountered
- `failed_instructor_tests` - Count of failed instructor test cases

### 2. AssignmentCounts
Tracks statistics for assignments.

**Fields:**
- `total_submissions` - Total number of submissions for this assignment
- `date_last_submission` - Timestamp of the most recent submission

### 3. CourseCounts
Tracks statistics for courses.

**Fields:**
- `total_submissions` - Total number of submissions in the course
- `total_assignments` - Total number of assignments in the course
- `total_assignment_groups` - Total number of assignment groups
- `total_users` - Total number of users enrolled in the course
- `total_students` - Total number of students in the course
- `total_instructors` - Total number of instructors in the course
- `date_last_user` - Timestamp when the last user was added
- `date_last_submission` - Timestamp of the most recent submission
- `date_last_assignment` - Timestamp when the last assignment was created

### 4. UserCounts
Tracks statistics for users.

**Fields:**
- `total_courses_in` - Total number of courses the user is enrolled in
- `total_assignments` - Total number of assignments assigned to the user
- `total_assignment_groups` - Total number of assignment groups
- `total_submissions` - Total number of submissions by the user
- `total_reports` - Total number of reports created by the user
- `estimated_time_spent` - Estimated total time spent by the user
- `last_logged_in` - Timestamp of the user's last login
- `last_edited` - Timestamp of the user's last edit

## Helper Functions

The `models/counters/helpers.py` module provides functions for updating counts:

### Ensure Functions
These functions ensure that a counts record exists for a given entity, creating one if necessary:
- `ensure_submission_counts(submission_id)`
- `ensure_assignment_counts(assignment_id)`
- `ensure_course_counts(course_id)`
- `ensure_user_counts(user_id)`

### Update Functions
These functions update specific metrics:

- `update_edit_time(submission_id, time_delta)` - Updates average edit time using Welford's online algorithm
- `update_run_count(submission_id)` - Increments run count
- `update_error_counts(submission_id, error_type)` - Increments error counts by type
- `increment_submission_count(assignment_id, course_id, user_id)` - Updates submission counts across all relevant tables
- `update_user_activity(user_id, activity_type)` - Updates user login/edit timestamps
- `increment_course_assignment_count(course_id)` - Increments assignment count for a course
- `increment_course_user_count(course_id, role)` - Increments user count for a course based on role

### Recalculation Function
- `recalculate_submission_counts_from_logs(submission_id)` - Recalculates counts from historical log data

This is useful for:
- Backfilling counts for existing data
- Fixing discrepancies
- Initial population of counts tables

## Integration Points

The counts tracking is automatically integrated at the following points:

### Submission Events
- **Creation** (`models/submission.py:from_assignment`) - Increments submission counts
- **Code Save** (`controllers/endpoints/blockpy.py:save_student_file`) - Updates user edit timestamp
- **Run Event** (`controllers/endpoints/blockpy.py:log_event`) - Increments run count
- **Feedback Event** (`controllers/endpoints/blockpy.py:log_event`) - Tracks error counts

### Assignment Events
- **Creation** (`models/assignment.py:new`) - Increments course assignment count

### Course & User Events
- **Course Creation** (`models/course.py:new`) - Tracks instructor addition
- **Role Addition** (`models/user.py:add_role`, `update_roles`) - Tracks user enrollment in courses
- **Login** (`controllers/auth.py:handle_login_change`) - Updates last login timestamp

## Running Statistics Algorithm

The average edit time uses Welford's online algorithm for computing running averages:

```python
new_avg = old_avg + (new_value - old_avg) / count
```

This allows us to maintain accurate averages without storing all historical data points, which is critical for performance with large datasets.

## Performance Benefits

By maintaining these counts:

1. **Instant Statistics** - No need to count millions of log entries
2. **Reduced Database Load** - Avoid expensive aggregation queries
3. **Scalability** - Constant-time updates regardless of historical data size
4. **Real-time Insights** - Statistics are always up-to-date

## Usage Example

```python
from models.counters.helpers import ensure_submission_counts

# Get counts for a submission
counts = ensure_submission_counts(submission_id)

# Access statistics
print(f"Runs: {counts.runs}")
print(f"Average edit time: {counts.average_edit_time} seconds")
print(f"Syntax errors: {counts.syntax_errors}")
```

## Backfilling Historical Data

To populate counts for existing data:

```python
from models.counters.helpers import recalculate_submission_counts_from_logs
from models.submission import Submission

# For a single submission
recalculate_submission_counts_from_logs(submission_id)

# For all submissions (in a management command)
for submission in Submission.query.all():
    recalculate_submission_counts_from_logs(submission.id)
```

## Future Enhancements

Potential future additions to the counts system:

1. **Standard Deviation Tracking** - Using Welford's algorithm for variance
2. **Percentile Tracking** - Using t-digest or similar algorithms
3. **Time-series Data** - Daily/weekly aggregates for trend analysis
4. **Assignment Group Counts** - Similar to other entities
5. **Report Counts** - Tracking report generation and usage
