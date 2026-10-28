# BlockPy React Frontend

A React TypeScript frontend for BlockPy, built with Vite. This runs **alongside** the existing KnockoutJS frontend — both are independently compiled and served.

## Structure

```
frontend-react/
  src/
    api/
      client.ts          # Typed API functions for all backend routes
      dashboardUtils.ts  # Data processing utilities
    components/
      dashboard/
        StatCard.tsx                 # Summary stat cards
        AssignmentSubmissionsChart.tsx  # Bar chart: submissions & edits
        ErrorRateChart.tsx           # Bar chart: error/success rates
        MetricsTable.tsx             # Per-assignment metrics table
        StudentTable.tsx             # Per-student summary table
    hooks/
      useFetch.ts        # Data-fetching React hooks
    pages/
      InstructorDashboard.tsx  # Main dashboard page
    types/
      models.ts          # TypeScript types matching backend models
```

## Development

```bash
cd frontend-react
npm install
npm run dev     # Dev server with proxy to Flask at localhost:5001
```

## Production Build

```bash
cd frontend-react
npm run build   # Outputs to ../static/libs/blockpy_react/
```

The built assets are served by Flask at `/dashboard` via `templates/react/dashboard.html`.

## Backend Routes Used

| Endpoint | Purpose |
|---|---|
| `GET /api/test` | Connection check |
| `GET /api/list/courses` | List courses for the current user |
| `GET /api/task_status/:id` | Poll background task status |
| `GET /api/reports` | List user reports |
| `GET /courses/fake_dashboard?course_id=X&mode=json` | Per-submission metrics |
| `GET /courses/fake_dashboard?course_id=X&mode=csv` | CSV export |
| `GET /assignments/get_ids?course_id=X` | List assignment IDs in a course |
| `GET /grading/get_grading_spreadsheet` | Grading data |
| `POST /blockpy/update_submission` | Submit/update a submission |
