# React Migration Plan

## Overview

This document describes the incremental strategy for replacing KnockoutJS UI components
with React + TypeScript components in the BlockPy server frontend.

## Current State

**Bundler:** Webpack 5  
**Language:** TypeScript 4  
**Output:** `static/libs/blockpy_server/frontend.js` and `frontend.css`  
**Global export:** `window.frontend.*` (library target `var`)

### Knockout Usage Summary

KnockoutJS is used throughout the frontend:

| File | KO Usage |
|---|---|
| `models/model.ts` | `ko.observable`, `ko.pureComputed`, `ko.observableArray` – base class |
| `models/assignment.ts` | KO observables for all fields |
| `models/assignment_group.ts` | KO observables |
| `models/assignment_tag.ts` | KO observables |
| `models/course.ts` | KO observables |
| `models/files.ts` | KO observables |
| `models/log.ts` | KO observables |
| `models/review.ts` | KO observables |
| `models/submission.ts` | KO observables |
| `models/user.ts` | KO observables, roles array |
| `services/server.ts` | `ko.pureComputed` for `isLoading` |
| `services/plugins.ts` | KO utility helpers |
| `components/assignment_manager.ts` | `ko.components.register` |
| `components/course_list.ts` | `ko.components.register`, `ko.observable` |
| `components/group_list.ts` | `ko.components.register`, `ko.observableArray` |
| `components/model_selector.ts` | `ko.components.register` |
| `components/review_interface.ts` | `ko.components.register` |
| `components/watcher/watcher.ts` | Heavy KO usage |
| `components/blockpy/blockpy_interface.ts` | KO component |
| `components/kettle/kettle.ts` | KO component |
| `components/quizzes/` | KO components |
| `components/reader/reader.ts` | KO component |
| `components/explanations/explain.ts` | KO component |
| `utilities/ko_record.ts` | KO utility |
| `utilities/timer.ts` | KO observable |

### Externals (kept as global variables)

`knockout`, `jquery`, `select2`, `highlight.js`, `codemirror`, `filepond`,
`browserfs`, `doppiojvm`, `ConTodo`, `skulkt`, `$URL_ROOT`

### Pages that Load `frontend.js`

- `templates/helpers/layout.html` – loaded on every page via Flask-Assets bundle

### Externally Used Frontend Symbols

From `templates/helpers/layout.html`:
- `frontend.prettyPrintDateTime(utc)` – used by `<local-time>` custom element

From `frontend/app.ts` exports (available as `window.frontend.*`):
- `dateCreatedSorter`, `generateUUID`, `getParameterByName`
- `prettyPrintDateTime`, `prettyPrintDateTimeString`
- `AssignmentGroup`, `GroupList`, `User`, `Assignment`
- `Server`, `Watcher`, `launchEditor`

---

## Migration Strategy

### Principles

1. **No big-bang rewrite.** Each component is migrated individually.
2. **React runs alongside Knockout** until every component on a page is migrated.
3. **A mounting layer** (`react/mount.tsx`) lets existing server-rendered pages
   bootstrap React components into named DOM elements without touching the Jinja templates.
4. **Shared logic is extracted** into pure TypeScript utilities/services modules that
   both Knockout and React components can import.
5. **KO code is deleted** only after all usages are confirmed gone and a full build passes.

### Directory Layout

```
frontend/
  react/
    index.tsx          # Registers all React components; exports mountReactComponent
    mount.tsx          # Generic mounting helpers (createRoot wrappers)
    components/        # React UI components
    hooks/             # Custom hooks
    services/          # Pure TS API/service logic (shared with KO layer)
    adapters/          # KO-to-React bridge adapters (temporary)
    types/             # Shared TypeScript interfaces / API response types
```

---

## Migration Candidates (Priority Order)

### Tier 1 – Safe to migrate now (minimal KO entanglement)

| Component | File | Notes |
|---|---|---|
| `AlertBanner` | `react/components/AlertBanner.tsx` | **New** – replaces ad-hoc Bootstrap alerts |
| `CourseList` | `components/course_list.ts` | Isolated KO component; sorting is pure TS |
| `GroupList` | `components/group_list.ts` | Small; depends only on `AssignmentGroup` model |

### Tier 2 – Medium complexity

| Component | File | Notes |
|---|---|---|
| `AssignmentManager` | `components/assignment_manager.ts` | Depends on Server and multiple stores |
| `ModelSelector` | `components/model_selector.ts` | Generic selector widget |
| `ReviewInterface` | `components/review_interface.ts` | Review submission UI |

### Tier 3 – High complexity / defer

| Component | File | Notes |
|---|---|---|
| `Watcher` | `components/watcher/watcher.ts` | 700+ lines, heavy KO, real-time polling |
| `BlockPyInterface` | `components/blockpy/blockpy_interface.ts` | Wraps external BlockPy editor |
| `Quizzer` | `components/quizzes/` | Multi-file quiz system |
| `Reader` | `components/reader/reader.ts` | Markdown reader |
| `Kettle` | `components/kettle/kettle.ts` | Kettle compiler |

---

## Step-by-Step Plan

### Step 1 ✅ – Scaffolding (this PR)

- [x] Add `react`, `react-dom`, `@types/react`, `@types/react-dom` as explicit deps
- [x] Set `"jsx": "react"` in `tsconfig.json` and include `react/` directory
- [x] Fix pre-existing `tsconfig.json` type reference (`CodeMirror` → `codemirror`)
- [x] Create `react/types/index.ts`
- [x] Create `react/mount.tsx` – generic `mountReactComponent` helper
- [x] Create `react/index.tsx` – registers all React components
- [x] Create `react/components/AlertBanner.tsx` – first simple React component
- [x] Export `mountReactComponent` from `app.ts`
- [x] Verify webpack build succeeds

### Step 2 – Migrate `CourseList`

- Extract pure sorting logic from `CourseListInterface` into `react/services/courseSort.ts`
- Create `react/components/CourseList.tsx` using `useState`/`useCallback`
- Register component in `react/index.tsx`
- Add `data-react-mount="course-list"` to the course listing template
- Verify Knockout `course-list` component is still registered (parallel run)
- Write manual verification steps

### Step 3 – Extract shared API service

- Move `ajax_get` / `ajax_post` wrappers into `react/services/api.ts` with typed
  response interfaces
- Both KO models and React hooks can import from there

### Step 4 – Migrate `GroupList`

- Create `react/components/GroupList.tsx`
- Create `react/hooks/useAssignmentGroups.ts`

### Step 5+ – Remaining Tier 2 / Tier 3 components

Tackle one at a time, following the same pattern:
1. Extract shared logic
2. Build React component
3. Run in parallel with KO component
4. Verify equivalence
5. Remove KO component

---

## Testing & Verification

### Build

```bash
cd frontend
npm run nowatch   # or: npx webpack --config webpack.config.js --mode=development
```

Expected output:
- `static/libs/blockpy_server/frontend.js`
- `static/libs/blockpy_server/frontend.css`

### TypeScript typecheck

```bash
cd frontend
npx tsc --noEmit
```

### Manual Verification Checklist

After each component migration:

- [ ] `frontend.js` is generated without errors
- [ ] Existing Knockout components still render on their pages
- [ ] Migrated React component mounts in the target DOM element
- [ ] No JS console errors on page load
- [ ] `frontend.mountReactComponent` is callable from browser console

---

## Known Limitations / Follow-Up Tasks

- **No unit tests yet.** The existing test setup (`karma`) targets TypeScript
  compilation but no component tests are configured. A future PR should add
  `@testing-library/react` or Vitest + jsdom.
- **Model layer stays KO for now.** `models/*.ts` and `services/server.ts` still
  use KO observables. React hooks will read plain values from these stores until
  the model layer is migrated.
- **`esModuleInterop` added.** This enables cleaner React imports but is backward
  compatible.
- **React is bundled, not external.** React (~50 kB gzipped) is included in
  `frontend.js`. A future optimization can split it out as a CDN external if
  bundle size becomes a concern.
