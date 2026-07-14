# Textbook Component

The Textbook component provides a navigation interface for organizing and accessing multiple readings in a hierarchical structure.

## Features

- **Tree Navigation**: Hierarchical reading organization with headers and groups
- **Reading Selection**: Click to load different readings
- **Browser History**: URL-based routing with back/forward button support
- **Responsive Design**: Mobile-friendly collapsible navigation
- **Reader Integration**: Embedded Reader component for content display
- **Visual Feedback**: Active reading highlighting
- **Nested Structure**: Unlimited nesting levels for organization

## Usage

```typescript
import { Textbook } from './components/textbook/Textbook';
import { User } from './models/user';

const textbookData = {
    settings: {},
    version: 1,
    content: [
        {
            header: "Chapter 1: Introduction",
            content: [
                {
                    reading: {
                        id: 1,
                        url: "intro",
                        name: "Getting Started",
                        missing: false
                    }
                },
                {
                    reading: {
                        id: 2,
                        url: "basics",
                        name: "Basic Concepts",
                        missing: false
                    }
                }
            ]
        }
    ]
};

const user = new User({
    id: 1,
    email: 'student@example.com',
    first_name: 'John',
    last_name: 'Doe'
});

<Textbook
    courseId={1}
    textbook={textbookData}
    isInstructor={false}
    user={user}
    initialPageId={1}
/>
```

## Props

- `courseId` - Course identifier
- `assignmentGroupId` - (Optional) Assignment group ID
- `textbook` - Textbook data structure
- `isInstructor` - Show instructor editing tools
- `user` - Current user object
- `initialPageId` - (Optional) ID of the initial reading to display

## Data Structure

### TextbookContent

```typescript
interface TextbookContent {
    header?: string;              // Section header (non-clickable)
    reading?: {                   // Clickable reading
        id: number;
        url: string;
        missing: boolean;
        name: string;
    };
    group?: {                     // Reading group (non-clickable)
        id: number;
        url: string;
        missing: boolean;
        name: string;
    };
    content?: TextbookContent[];  // Nested content
}
```

### TextbookData

```typescript
interface TextbookData {
    settings: Record<string, any>;
    version: number;
    content: TextbookContent[];
}
```

## Example Structure

```json
{
    "settings": {},
    "version": 1,
    "content": [
        {
            "header": "Chapter 1: Introduction"
        },
        {
            "reading": {
                "id": 1,
                "url": "intro",
                "name": "1.1 Getting Started",
                "missing": false
            }
        },
        {
            "reading": {
                "id": 2,
                "url": "variables",
                "name": "1.2 Variables",
                "missing": false
            }
        },
        {
            "header": "Chapter 2: Control Flow",
            "content": [
                {
                    "reading": {
                        "id": 3,
                        "url": "if-statements",
                        "name": "2.1 If Statements",
                        "missing": false
                    }
                },
                {
                    "reading": {
                        "id": 4,
                        "url": "loops",
                        "name": "2.2 Loops",
                        "missing": false
                    }
                }
            ]
        }
    ]
}
```

## Integration Example

```javascript
frontendSolid.initTextbook('#container', {
    courseId: 1,
    textbook: textbookData,
    isInstructor: false,
    user: currentUser,
    initialPageId: 1
});
```

## Features

### Navigation

- **Headers**: Non-clickable section dividers
- **Readings**: Clickable items that load content
- **Groups**: Non-clickable organizational items
- **Nesting**: Indented items show hierarchy

### URL Routing

The textbook updates the browser URL when navigating:

```
/textbook?page=intro
/textbook?page=variables
```

This allows:
- Direct links to specific readings
- Back/forward browser buttons
- Bookmarking specific pages

### Visual Feedback

- **Active**: Highlighted current reading
- **Disabled**: Grayed-out non-clickable items
- **Hover**: Visual feedback on clickable items
- **Indentation**: Shows hierarchy level

## Styling

The textbook uses Bootstrap 5 classes:

- `.textbook-navigation` - Navigation sidebar
- `.book-item` - Individual items
- `.list-group-item-info` - Top-level reading highlight
- `.list-group-item-secondary` - Disabled items
- `.active` - Current reading

## Responsive Design

On mobile devices:
- Navigation collapses to 300px height
- Horizontal scrolling enabled
- Border changes from right to bottom

## Conversion from KnockoutJS

**Key Changes:**

```typescript
// KnockoutJS
this.pageId = ko.observable(initialPageId);

// SolidJS
const [currentReadingId, setCurrentReadingId] = createSignal(initialPageId);
```

**Template Conversion:**

```tsx
// KnockoutJS
<!-- ko foreach: textbook.content -->
<textbook-content params="content: $data"></textbook-content>
<!-- /ko -->

// SolidJS
<For each={textbook.content}>
    {(item) => <TextbookItem item={item} indent={0} />}
</For>
```

## Future Enhancements

- Search functionality
- Completion tracking per reading
- Progress indicators
- Reading time estimates
- Table of contents generation
- Print-friendly view
