# HTMX Frontend for BlockPy Server

This directory contains the new HTMX-based frontend for BlockPy Server, providing an alternative to the existing Knockout.js implementation.

## Overview

The HTMX version uses server-side rendering with dynamic HTML updates instead of client-side JavaScript framework state management. This approach offers several benefits:

- **Simpler Code**: Logic stays on the server where it's easier to maintain
- **Less JavaScript**: No heavy client-side framework needed
- **Progressive Enhancement**: Works without JavaScript (degrades gracefully)
- **Better SEO**: Server-rendered content is more search-engine friendly
- **Faster Initial Load**: Less JavaScript to download and parse

## Architecture

### Directory Structure

```
templates/htmx/
├── layout.html           # Base template with HTMX integration
├── index.html            # Home page
├── courses.html          # Courses list page
├── course_detail.html    # Individual course page
└── partials/             # Reusable HTML fragments
    ├── courses_list.html
    └── assignments_list.html

controllers/endpoints/
└── htmx_routes.py        # Flask blueprint for HTMX endpoints
```

### Key Components

1. **Layout Template** (`templates/htmx/layout.html`)
   - Includes HTMX library from CDN
   - Provides base navigation and structure
   - Includes Bootstrap CSS for styling

2. **Routes** (`controllers/endpoints/htmx_routes.py`)
   - Flask blueprint mounted at `/htmx`
   - Handles both full page and partial HTML responses
   - Detects HTMX requests via `HX-Request` header

3. **Partial Templates** (`templates/htmx/partials/`)
   - Small HTML fragments for dynamic updates
   - Can be loaded independently via HTMX
   - Reusable across different pages

## Usage

### Accessing the HTMX Version

Navigate to `/htmx/` to access the new frontend. Links are also available from the main index page.

### Adding New Pages

1. Create a template in `templates/htmx/`
2. Add a route in `controllers/endpoints/htmx_routes.py`
3. Create any needed partial templates in `templates/htmx/partials/`

Example:

```python
@htmx_routes.route('/my-page', methods=['GET'])
def my_page():
    data = get_my_data()
    return render_template('htmx/my_page.html', data=data)
```

### HTMX Patterns Used

#### 1. **Click to Load**
```html
<button hx-get="/htmx/data" 
        hx-target="#result" 
        hx-swap="innerHTML">
    Load Data
</button>
<div id="result"></div>
```

#### 2. **Search with Delay**
```html
<input type="text" 
       hx-get="/htmx/search" 
       hx-trigger="keyup changed delay:500ms"
       hx-target="#results">
```

#### 3. **Load Once**
```html
<button hx-get="/htmx/data" 
        hx-trigger="click once">
    Load Once
</button>
```

#### 4. **Form Submission**
```html
<form hx-post="/htmx/submit" 
      hx-target="#response">
    <!-- form fields -->
    <button type="submit">Submit</button>
</form>
```

## Comparison with Knockout.js Version

### Knockout.js (Current)
- Client-side state management with observables
- Two-way data binding
- Logic spread across templates and JavaScript
- Requires understanding of Knockout patterns

### HTMX (New)
- Server-side state management
- One-way HTML updates
- Logic centralized in Python controllers
- Uses standard HTML attributes

## Development Guidelines

1. **Keep Partials Small**: Each partial should be focused on one piece of UI
2. **Server-Side Logic**: Move as much logic as possible to the Python backend
3. **Progressive Enhancement**: Ensure basic functionality works without HTMX
4. **Consistent Naming**: Use descriptive names for endpoints and templates
5. **Error Handling**: Return appropriate error messages in HTML format

## Future Enhancements

The following features could be added to the HTMX frontend:

- [ ] Assignment management interface
- [ ] Grading interface
- [ ] User management
- [ ] Course creation and editing
- [ ] Real-time updates using Server-Sent Events (SSE)
- [ ] Form validation with HTMX
- [ ] Modal dialogs
- [ ] Infinite scroll for long lists
- [ ] Optimistic UI updates

## Testing

To test the HTMX implementation:

1. Start the server: `python main.py`
2. Navigate to `/htmx/` in your browser
3. Test the demo button on the home page
4. Try the courses page with search and filtering
5. Verify partial updates work without full page reloads

## Resources

- [HTMX Documentation](https://htmx.org/)
- [HTMX Examples](https://htmx.org/examples/)
- [Hypermedia Systems Book](https://hypermedia.systems/)
