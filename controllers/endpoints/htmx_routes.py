"""
HTMX-based routes for the new frontend.
This provides an alternative to the Knockout.js-based interface.
"""
from flask import Blueprint, render_template, request, g, jsonify, flash, redirect, url_for
from models.course import Course
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.submission import Submission
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


@htmx_routes.route('/assignments/<int:assignment_id>', methods=['GET'])
def assignment_detail(assignment_id):
    """
    Show details for a specific assignment.
    """
    assignment = Assignment.by_id(assignment_id)
    if not assignment:
        return "<div class='alert alert-danger'>Assignment not found</div>", 404
    
    course_id = request.args.get('course_id')
    if not course_id:
        return "<div class='alert alert-danger'>Course ID required</div>", 400
    
    course = Course.by_id(course_id)
    if not course or not course.is_user(g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    return render_template('htmx/assignment_detail.html', 
                         assignment=assignment,
                         course=course)


@htmx_routes.route('/assignment-groups/<int:group_id>/toggle', methods=['POST'])
def toggle_assignment_group(group_id):
    """
    Toggle visibility of an assignment group (HTMX endpoint).
    """
    group = AssignmentGroup.by_id(group_id)
    if not group:
        return "<div class='alert alert-danger'>Group not found</div>", 404
    
    course = Course.by_id(group.course_id)
    if not course or not course.is_instructor(g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    # Toggle some property (example)
    # In a real implementation, you'd update the database
    return f"""
    <button class="btn btn-sm btn-success" 
            hx-post="{url_for('htmx_routes.toggle_assignment_group', group_id=group_id)}"
            hx-swap="outerHTML">
        Toggled!
    </button>
    """


@htmx_routes.route('/assignments/<int:assignment_id>/submissions', methods=['GET'])
def assignment_submissions(assignment_id):
    """
    Get submissions for an assignment (HTMX partial).
    """
    assignment = Assignment.by_id(assignment_id)
    if not assignment:
        return "<div class='alert alert-danger'>Assignment not found</div>", 404
    
    course_id = request.args.get('course_id')
    course = Course.by_id(course_id)
    if not course or not course.is_instructor(g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    # Get submissions (simplified - in real implementation would paginate)
    submissions = assignment.get_submissions()[:10]  # Limit to 10 for demo
    
    return render_template('htmx/partials/submissions_list.html',
                         submissions=submissions,
                         assignment=assignment,
                         course=course)


@htmx_routes.route('/assignments/<int:assignment_id>/stats', methods=['GET'])
def assignment_stats(assignment_id):
    """
    Get statistics for an assignment (HTMX partial).
    """
    assignment = Assignment.by_id(assignment_id)
    if not assignment:
        return "<div class='alert alert-danger'>Assignment not found</div>", 404
    
    course_id = request.args.get('course_id')
    course = Course.by_id(course_id)
    if not course or not course.is_user(g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    # Calculate some basic stats
    total_submissions = len(assignment.get_submissions())
    
    return f"""
    <dl class="row">
        <dt class="col-sm-6">Total Submissions:</dt>
        <dd class="col-sm-6">{total_submissions}</dd>
        
        <dt class="col-sm-6">Assignment ID:</dt>
        <dd class="col-sm-6">{assignment.id}</dd>
    </dl>
    <small class="text-muted">Statistics loaded at {datetime.now().strftime('%I:%M %p')}</small>
    """




@htmx_routes.route('/submissions/<int:submission_id>', methods=['GET'])
def submission_detail(submission_id):
    """
    Get details for a specific submission (HTMX partial).
    """
    submission = Submission.by_id(submission_id)
    if not submission:
        return "<div class='alert alert-danger'>Submission not found</div>", 404
    
    # Check access - must be instructor or owner
    assignment = submission.assignment
    course = assignment.course
    
    if not (course.is_instructor(g.user.id) or submission.user_id == g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    return render_template('htmx/partials/submission_detail.html',
                         submission=submission,
                         assignment=assignment,
                         course=course)


@htmx_routes.route('/submissions/<int:submission_id>/code', methods=['GET'])
def submission_code(submission_id):
    """
    Get code for a submission (HTMX partial).
    """
    submission = Submission.by_id(submission_id)
    if not submission:
        return "<div class='alert alert-danger'>Submission not found</div>", 404
    
    # Check access
    assignment = submission.assignment
    course = assignment.course
    
    if not (course.is_instructor(g.user.id) or submission.user_id == g.user.id):
        return "<div class='alert alert-danger'>Access denied</div>", 403
    
    code = submission.code if submission.code else "No code available"
    
    return f"""
    <pre class="bg-light p-3 rounded"><code>{code}</code></pre>
    """
