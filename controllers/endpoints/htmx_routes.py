"""
HTMX-based routes for the new frontend.
This provides an alternative to the Knockout.js-based interface.
"""
from flask import Blueprint, render_template, request, g, jsonify
from models.course import Course
from models.user import User
from datetime import datetime

htmx_routes = Blueprint('htmx_routes', __name__, url_prefix='/htmx')


@htmx_routes.route('/', methods=['GET'])
def index():
    """
    Main index page for the HTMX version.
    """
    return render_template('htmx/index.html')


@htmx_routes.route('/demo-response', methods=['GET'])
def demo_response():
    """
    Simple demo endpoint to show HTMX working.
    """
    return f"""
    <div class="alert alert-success" style="display: block;">
        <strong>Success!</strong> HTMX is working! 
        Server time: {datetime.now().strftime('%H:%M:%S')}
    </div>
    """


@htmx_routes.route('/courses', methods=['GET'])
def courses():
    """
    List courses for the current user.
    Supports HTMX partial updates with search and filter.
    """
    if not g.user or g.user.anonymous:
        return render_template('htmx/courses.html', courses=[], is_instructor=False)
    
    # Get search and filter parameters
    search = request.args.get('search', '').strip()
    filter_type = request.args.get('filter', 'all')
    
    # Get user's courses
    if g.user.is_instructor():
        # Instructors see courses they teach
        courses = Course.get_courses_for_user(g.user.id, role='instructor')
    else:
        # Students see courses they're enrolled in
        courses = Course.get_courses_for_user(g.user.id)
    
    # Apply search filter
    if search:
        courses = [c for c in courses if search.lower() in c.name.lower()]
    
    # Apply type filter
    if filter_type == 'teaching' and g.user.is_instructor():
        courses = [c for c in courses if c.is_instructor(g.user.id)]
    elif filter_type == 'enrolled':
        courses = [c for c in courses if not c.is_instructor(g.user.id)]
    
    # Check if this is an HTMX request (for partial update)
    is_htmx = request.headers.get('HX-Request') == 'true'
    
    if is_htmx:
        # Return just the courses list partial
        return render_template('htmx/partials/courses_list.html', 
                             courses=courses,
                             is_instructor=g.user.is_instructor())
    else:
        # Return the full page
        return render_template('htmx/courses.html', 
                             courses=courses,
                             is_instructor=g.user.is_instructor())


@htmx_routes.route('/courses/<int:course_id>', methods=['GET'])
def course_detail(course_id):
    """
    Show details for a specific course.
    """
    course = Course.by_id(course_id)
    if not course:
        return "<div class='alert alert-danger'>Course not found</div>", 404
    
    # Check user has access
    if not course.is_user(g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    return render_template('htmx/course_detail.html', course=course)


@htmx_routes.route('/courses/<int:course_id>/assignments', methods=['GET'])
def course_assignments(course_id):
    """
    Get assignments for a course (HTMX partial).
    """
    course = Course.by_id(course_id)
    if not course or not course.is_user(g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    assignments = course.get_assignments()
    
    return render_template('htmx/partials/assignments_list.html', 
                         assignments=assignments,
                         course=course)
