# SubmissionFilterTable Component

A comprehensive SolidJS component for viewing, filtering, sorting, and managing student submissions. Replaces the `templates/helpers/submission_table.html` template with modern reactive patterns.

## Features

- **Sortable Columns** - Click any column header to sort ascending/descending
- **Color-coded Rows** - Green (correct), yellow (partial), white (incomplete)
- **Filter Modes** - View by assignment, student, or all
- **Bulk Operations** - Regrade all or download all submissions
- **Show/Hide Non-learners** - Filter out TAs and instructors
- **Individual Actions** - View, download, regrade for each submission

## Usage

```typescript
import { render } from 'solid-js/web';
import { SubmissionFilterTable } from './components/submissions/SubmissionFilterTable';

const container = document.getElementById('submission-filter-container');
render(() => (
    <SubmissionFilterTable
        submissions={submissionsData}
        criteria="assignment"
        searchKey={123}
        courseId={456}
        isInstructor={true}
    />
), container);
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `submissions` | `Array<[SubmissionData, UserData, AssignmentData, CourseData]>` | Array of submission tuples |
| `criteria` | `'assignment' \| 'student' \| null` | Filter mode (optional) |
| `searchKey` | `number` | Assignment ID or User ID to filter by (optional) |
| `courseId` | `number` | Current course ID |
| `groupHeaders` | `Record<number, GroupHeader>` | Map of assignment IDs to group info (optional) |
| `isInstructor` | `boolean` | Whether current user is an instructor |

## Row Coloring

Rows are color-coded based on submission status:

- **Green** (`table-success`): correct OR score >= 100 OR type === 'reading'
- **Yellow** (`table-warning`): score > 0 AND score < 100
- **White** (default): incomplete or not started

## Filter Modes

### Assignment View (`criteria="assignment"`)
- Shows all students for one assignment
- Hides assignment column
- Shows "Show only learners" checkbox

### Student View (`criteria="student"`)
- Shows all assignments for one student
- Hides student and role columns

### All View (`criteria=null`)
- Shows all submissions
- Displays all columns

## API Integration

Backend endpoints used:

```
POST /assignments/regrade
    Body: { submission_id: number, as_human: boolean }
    Response: { success: boolean, message: string, grading_status: string }

GET /assignments/estimate_duration?submission_id={id}
    Response: { duration: number }
```

## Template Integration

Replace this line in `submissions_filter.html`:

```html
{% include "helpers/submission_table.html" %}
```

With:

```html
<div id="submission-filter-container"></div>
<script src="{{ url_for('static', filename='libs/blockpy_server_solid/frontend-solid.js') }}"></script>
<script>
  frontendSolid.initSubmissionFilterTable('#submission-filter-container', {
    submissions: {{ submissions|tojson }},
    criteria: {{ criteria|tojson }},
    searchKey: {{ search_key|tojson }},
    courseId: {{ course_id }},
    groupHeaders: {{ group_headers|tojson }},
    isInstructor: {{ is_instructor|tojson }}
  });
</script>
```

## Styling

Uses Bootstrap 5 classes:
- `table`, `table-condensed`, `table-hover`, `table-striped`, `table-bordered`
- `table-success` (green), `table-warning` (yellow), `table-secondary` (gray)
- `btn-primary`, `btn-outline-secondary`
- `dropdown-menu`, `dropdown-item`

Custom classes:
- `non-learner-row` - For TAs/instructors (can be hidden)
- `green-check-mark` - Green checkmark icon
- `red-x` - Red X icon
