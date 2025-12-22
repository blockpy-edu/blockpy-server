# HTMX Frontend User Guide

## Overview

This guide provides instructions on how to use and extend the new HTMX-based frontend for BlockPy Server.

## Getting Started

### Accessing the HTMX Frontend

1. Navigate to your BlockPy Server instance
2. From the home page, click "Try HTMX Version" or go directly to `/htmx/`
3. You'll see the new interface with HTMX-powered interactions

### Key Features

#### 1. Dynamic Course List
- **Location**: `/htmx/courses`
- **Features**:
  - Real-time search (debounced 500ms)
  - Filter by teaching/enrolled courses
  - Click to expand assignments without page reload

#### 2. Course Detail
- **Location**: `/htmx/courses/<course_id>`
- **Features**:
  - Lazy-load assignments
  - Quick actions panel
  - Course information display

#### 3. Assignment Detail
- **Location**: `/htmx/assignments/<assignment_id>`
- **Features**:
  - View assignment details
  - Load statistics on-demand
  - View submissions (instructors only)
  - Expandable submission details

#### 4. Submissions Viewing
- **Features**:
  - Table view of all submissions
  - Click to expand individual submission
  - View code without full page load
  - Status indicators (correct/in progress)

## HTMX Interaction Patterns

### Pattern 1: Click to Load
```html
<button hx-get="/htmx/data" 
        hx-target="#result" 
        hx-swap="innerHTML">
    Load Data
</button>
<div id="result"></div>
```
**When to use**: Lazy loading content that isn't immediately needed

### Pattern 2: Search with Debounce
```html
<input type="text" 
       hx-get="/htmx/search" 
       hx-trigger="keyup changed delay:500ms"
       hx-target="#results">
```
**When to use**: Search functionality to avoid excessive server requests

### Pattern 3: Load Once
```html
<button hx-get="/htmx/data" 
        hx-trigger="click once">
    Load Once
</button>
```
**When to use**: One-time actions like expanding details

### Pattern 4: Inline Editing
```html
<div hx-get="/htmx/edit/123" 
     hx-trigger="click"
     hx-swap="outerHTML">
    Click to edit
</div>
```
**When to use**: In-place editing without navigation

## Adding New Pages

### Step 1: Create the Template

Create a new file in `templates/htmx/`:

```html
{% extends 'htmx/layout.html' %}

{% block title %}My Page{% endblock %}

{% block body %}
<h1>My New Page</h1>
<div id="content">
    <!-- Your content here -->
</div>
{% endblock %}
```

### Step 2: Add the Route

In `controllers/endpoints/htmx_routes.py`:

```python
@htmx_routes.route('/my-page', methods=['GET'])
def my_page():
    data = get_my_data()
    return render_template('htmx/my_page.html', data=data)
```

### Step 3: Create Partial Templates

For dynamic content, create partials in `templates/htmx/partials/`:

```html
<!-- partials/my_data.html -->
{% if items %}
    <ul class="list-group">
        {% for item in items %}
        <li class="list-group-item">{{ item.name }}</li>
        {% endfor %}
    </ul>
{% else %}
    <p>No items found.</p>
{% endif %}
```

### Step 4: Add HTMX Interactions

```python
@htmx_routes.route('/my-page/data', methods=['GET'])
def my_page_data():
    items = get_items()
    
    # Check if this is an HTMX request
    is_htmx = request.headers.get('HX-Request') == 'true'
    
    if is_htmx:
        return render_template('htmx/partials/my_data.html', items=items)
    else:
        return render_template('htmx/my_page.html', items=items)
```

## Testing Your Implementation

### 1. Browser DevTools
- Open Chrome/Firefox DevTools
- Check Network tab for HTMX requests
- Look for requests with `HX-Request: true` header

### 2. Manual Testing
```python
# Test a specific route
curl -H "HX-Request: true" http://localhost:5000/htmx/courses
```

### 3. Template Validation
```bash
python -c "
from jinja2 import Environment, FileSystemLoader
env = Environment(loader=FileSystemLoader('templates'))
template = env.get_template('htmx/my_page.html')
print('Template valid!')
"
```

## Best Practices

### 1. Keep Partials Small and Focused
❌ Bad:
```html
<!-- Too many responsibilities -->
<div>
    <header>...</header>
    <main>...</main>
    <footer>...</footer>
</div>
```

✅ Good:
```html
<!-- Single responsibility -->
<div class="course-card">
    <h5>{{ course.name }}</h5>
    <p>{{ course.description }}</p>
</div>
```

### 2. Use Server-Side Logic
❌ Bad (client-side filtering):
```html
<script>
    function filterCourses() {
        // Complex filtering logic
    }
</script>
```

✅ Good (server-side filtering):
```python
@htmx_routes.route('/courses')
def courses():
    search = request.args.get('search', '')
    courses = Course.query.filter(
        Course.name.ilike(f'%{search}%')
    ).all()
    return render_template('htmx/partials/courses.html', courses=courses)
```

### 3. Provide Fallbacks
```html
<!-- Works with and without HTMX -->
<a href="/htmx/detail/123" 
   hx-get="/htmx/detail/123"
   hx-target="#detail">
    View Details
</a>
```

### 4. Error Handling
```python
@htmx_routes.route('/data')
def get_data():
    try:
        data = fetch_data()
        return render_template('htmx/partials/data.html', data=data)
    except Exception as e:
        return f"<div class='alert alert-danger'>Error: {str(e)}</div>", 500
```

## Common Issues and Solutions

### Issue 1: Content Not Updating
**Problem**: HTMX not replacing content
**Solution**: Check `hx-target` selector is correct
```html
<!-- Make sure target exists -->
<button hx-get="/data" hx-target="#result">Load</button>
<div id="result"></div>  <!-- Not #results! -->
```

### Issue 2: Multiple Requests
**Problem**: Too many requests being sent
**Solution**: Add debounce or use `once` trigger
```html
<input hx-get="/search" 
       hx-trigger="keyup changed delay:500ms">
```

### Issue 3: Missing Context
**Problem**: Template variables undefined
**Solution**: Ensure all variables are passed from route
```python
return render_template('htmx/page.html', 
                      var1=value1,
                      var2=value2)
```

## Performance Tips

1. **Use `hx-trigger="click once"`** for one-time loads
2. **Add loading indicators**: 
   ```html
   <button hx-get="/data" hx-indicator="#spinner">
       Load
       <span id="spinner" class="htmx-indicator">Loading...</span>
   </button>
   ```
3. **Limit initial page weight**: Load data on-demand
4. **Cache on server**: Use Flask caching for expensive queries
5. **Paginate results**: Don't load all records at once

## Comparison with Knockout.js

| Feature | Knockout.js | HTMX |
|---------|-------------|------|
| State Management | Client-side observables | Server-side |
| Data Binding | Two-way | One-way (server → client) |
| Learning Curve | Medium | Low |
| JavaScript Required | Yes | No (progressive enhancement) |
| SEO Friendly | No | Yes |
| Bundle Size | ~67KB | ~14KB |

## Next Steps

After familiarizing yourself with the basics:

1. **Explore Advanced Features**:
   - WebSockets with htmx-ws extension
   - Server-Sent Events for real-time updates
   - History management with `hx-push-url`

2. **Integrate with Existing Features**:
   - Connect to grading dashboard
   - Add user management interface
   - Implement course creation forms

3. **Optimize Performance**:
   - Add caching layers
   - Implement pagination
   - Use database query optimization

4. **Enhance UX**:
   - Add animations with htmx-css transitions
   - Implement optimistic updates
   - Add better error messages

## Resources

- [HTMX Documentation](https://htmx.org/docs/)
- [HTMX Examples](https://htmx.org/examples/)
- [Hypermedia Systems Book](https://hypermedia.systems/) - Free online book
- [HTMX Discord](https://htmx.org/discord) - Community support
- [Flask Documentation](https://flask.palletsprojects.com/)

## Support

For questions or issues:
1. Check the [HTMX docs](https://htmx.org/)
2. Review the example templates in `templates/htmx/`
3. Look at existing routes in `controllers/endpoints/htmx_routes.py`
4. Open an issue on the BlockPy Server GitHub repository
