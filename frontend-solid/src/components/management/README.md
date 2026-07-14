# Management Components

This directory contains administrative and management components for the BlockPy Server SolidJS frontend.

## Components

### AssignmentManager

Comprehensive CRUD interface for managing assignments and assignment groups.

**Features:**
- List all assignments with metadata (title, URL, date modified, instructions)
- Create new assignments (7 types: BlockPy, Reading, Quiz, TypeScript, Textbook, Code Explanation, Maze)
- Create assignment groups for organization
- Move assignments between groups
- Edit and delete operations
- Import/export functionality (placeholder)

**Usage:**
```javascript
frontendSolid.initAssignmentManager('#container', {
    courseId: 1,
    user: currentUser
});
```

**Assignment Types:**
- `BlockPy` - BlockPy coding problems
- `Reading` - Reading materials
- `quiz` - Quiz questions  
- `TypeScript` - TypeScript exercises
- `Textbook` - Textbook chapters
- `explain` - Code explanation tasks
- `Maze` - Maze programming puzzles (with level 1-10)

### CourseList

Display and manage a list of courses with sorting and pinning functionality.

**Features:**
- Display courses with metadata (name, URL, LMS info, creation date)
- 4 sort modes: Date created (asc/desc), Name (asc/desc)
- Pin/unpin courses (saved to backend)
- Show user role for each course (Student, TA, Instructor, etc.)
- Quick navigation to courses

**Usage:**
```javascript
frontendSolid.initCourseList('#container', {
    courses: coursesArray,
    user: currentUser,
    label: 'active-courses'
});
```

**Sort Methods:**
- `date_created_desc` - Most recently created first (default)
- `date_created_asc` - Oldest first
- `name_asc` - Alphabetical (A-Z)
- `name_desc` - Reverse alphabetical (Z-A)

### GroupList

Simple component for displaying assignment groups.

**Features:**
- Display assignment groups with names and URLs
- Load groups from backend API
- Loading and error states
- Empty state handling

**Usage:**
```javascript
frontendSolid.initGroupList('#container', {
    courseId: 1
});
```

### ModelSelector

Generic component for selecting models (Users, Assignments, etc.) with support for custom sets.

**Features:**
- 3 selection modes: All, Single, Set
- Custom set creation and management
- Local storage persistence for sets
- Grouped display (by role for users, by group for assignments)
- Bulk operations support
- Show/hide full list when many items

**Usage:**
```javascript
// For user selection
frontendSolid.initModelSelector('#container', {
    models: usersArray,
    label: 'User',
    storageKey: 'USER_SETS_COURSE_123',
    onSelectionChange: (selectedIds) => {
        console.log('Selected user IDs:', selectedIds);
    }
});

// For assignment selection
frontendSolid.initModelSelector('#container', {
    models: assignmentsArray,
    label: 'Assignment',
    storageKey: 'ASSIGNMENT_SETS_COURSE_123',
    onSelectionChange: (selectedIds) => {
        console.log('Selected assignment IDs:', selectedIds);
    }
});
```

**Selection Modes:**
- `ALL` - Select all available models
- `SINGLE` - Select one specific model from dropdown
- `SET` - Select a pre-defined or custom set of models

**Set Management:**
- Create custom sets with names
- Edit existing sets (add/remove members)
- Delete custom sets (cannot delete default "All" set)
- Persistent storage via localStorage

### UserEditor

User settings and preferences management.

**Features:**
- Sort order preferences (First Last, Last First, Email, BlockPy ID, Date Created)
- Render style preferences (Compact, Detailed)
- Callback support for settings changes

**Usage:**
```javascript
frontendSolid.initUserEditor('#container', {
    initialSortOrder: 'first_last',
    initialRenderStyle: 'detailed',
    onSortOrderChange: (order) => {
        console.log('Sort order changed:', order);
    },
    onRenderStyleChange: (style) => {
        console.log('Render style changed:', style);
    }
});
```

**Sort Orders:**
- `first_last` - First name, Last name
- `last_first` - Last name, First name
- `email` - Email address
- `blockpy_id` - BlockPy ID number
- `date_created` - Date account created

**Render Styles:**
- `compact` - Minimal display
- `detailed` - Full information display

## Architecture

All management components follow SolidJS reactive patterns:

**State Management:**
```typescript
// KnockoutJS
this.assignments = ko.observableArray<Assignment>([]);
this.groups = ko.observableArray<AssignmentGroup>([]);

// SolidJS
const [assignments, setAssignments] = createSignal<Assignment[]>([]);
const [groups, setGroups] = createSignal<AssignmentGroup[]>([]);
```

**Computed Values:**
```typescript
// KnockoutJS
this.sorter = ko.pureComputed(() => { /* ... */ });

// SolidJS
const sorter = createMemo(() => { /* ... */ });
```

**Modal Management:**
```typescript
// KnockoutJS: data-toggle="modal"

// SolidJS: State-based
const [showModal, setShowModal] = createSignal(false);
<Show when={showModal()}>
    <Modal onClose={() => setShowModal(false)} />
</Show>
```

## API Endpoints

**AssignmentManager:**
- `POST /assignments/get_all` - Load all assignments and groups
- `POST /assignments/create` - Create new assignment
- `POST /assignment_groups/create` - Create new group
- `POST /assignments/move_group` - Move assignment to group
- `POST /assignments/delete` - Delete assignment

**CourseList:**
- `POST /courses/pin_course` - Pin/unpin course

**GroupList:**
- `GET /get/` - Load groups (with course_id parameter)

## Testing

All components include comprehensive test coverage:

```bash
cd frontend-solid
npm test
```

Test files located in `tests/unit/`:
- `assignment-manager.test.tsx`
- `course-list.test.tsx`
- `group-list.test.tsx`
- `model-selector.test.tsx`
- `user-editor.test.tsx`

## Styling

Components use Bootstrap 5 classes for styling:
- `.table` - Table layouts
- `.modal` - Modal dialogs
- `.btn` - Buttons
- `.form-control` - Form inputs
- `.dropdown` - Dropdown menus

Custom styles can be added via component-specific CSS files or global stylesheets.

## Future Enhancements

- Import/export functionality for assignments
- Bulk operations for assignments
- Advanced filtering and search
- Drag-and-drop reordering
- Assignment templates
- Group hierarchies
- Role-based permissions
