# Reader Component

The Reader component displays reading assignments with support for videos, YouTube embeds, markdown content, and activity tracking.

## Features

- **Content Display**: Markdown-rendered instructions with headers and summaries
- **Video Support**: Native HTML5 video player with captions
- **YouTube Integration**: Embedded YouTube videos with API support
- **Voice Selection**: Multiple voice/narrator options for videos
- **Activity Tracking**: Logs reading time, scrolling, and video watching
- **Exam Support**: Timer functionality for timed assessments
- **Instructor Tools**: Raw and form-based editors for content management
- **Popout Mode**: Open reading in separate window
- **File Downloads**: Download slides and supplementary materials

## Usage

```typescript
import { Reader } from './components/reader/Reader';
import { User } from './models/user';

const user = new User({
    id: 1,
    email: 'student@example.com',
    first_name: 'John',
    last_name: 'Doe'
});

<Reader
    courseId={courseId}
    currentAssignmentId={assignmentId}
    assignmentGroupId={groupId}
    isInstructor={false}
    user={user}
    onMarkCorrect={(id) => console.log('Completed:', id)}
/>
```

## Props

- `courseId` - Course identifier
- `currentAssignmentId` - Assignment to display
- `assignmentGroupId` - (Optional) Assignment group ID
- `isInstructor` - Show instructor editing tools
- `asPreamble` - Display as preamble (hides some controls)
- `user` - Current user object
- `onMarkCorrect` - Callback when reading is marked complete

## Configuration

Settings are stored in the assignment's `settings` JSON field:

```json
{
    "header": "Introduction to Python",
    "summary": "Learn the basics...",
    "youtube": "VIDEO_ID",
    "video": "/path/to/video.mp4",
    "slides": "/path/to/slides.pdf",
    "popout": true,
    "start_timer_button": false
}
```

### Multiple Voice Options

For multiple narrators/voices:

```json
{
    "youtube": {
        "Dr. Smith": "VIDEO_ID_1",
        "Prof. Jones": "VIDEO_ID_2"
    },
    "video": {
        "English": "/videos/lesson1_en.mp4",
        "Spanish": "/videos/lesson1_es.mp4"
    }
}
```

## Editor Modes

**Instructors have three editor modes:**

1. **RAW** - Direct editing of instructions and settings JSON
2. **FORM** - Structured form with fields for common settings
3. **SUBMISSION** - Student view (actual reader)

## Integration Example

```javascript
frontendSolid.initReader('#container', {
    courseId: 1,
    currentAssignmentId: 42,
    assignmentGroupId: 5,
    isInstructor: false,
    user: currentUser
});
```

## Conversion from KnockoutJS

**Key Changes:**

```typescript
// KnockoutJS
this.youtube = ko.observable("");
this.youtubeOptions = ko.observable({});

// SolidJS
const [youtube, setYoutube] = createSignal("");
const [youtubeOptions, setYoutubeOptions] = createSignal({});
```

**Reactivity:**

```typescript
// KnockoutJS
this.currentAssignmentId.subscribe((newId) => {
    this.loadReading(newId);
});

// SolidJS
createEffect(() => {
    const assignmentId = props.currentAssignmentId;
    if (assignmentId) {
        loadReading(assignmentId);
    }
});
```
