# Flask imports
from quart import Blueprint, render_template, g, request

from models.assignment import Assignment

from controllers.helpers import parse_assignment_load

blueprint_maze = Blueprint('maze', __name__, url_prefix='/maze')


@blueprint_maze.route('/', methods=['GET', 'POST'])
@blueprint_maze.route('/load', methods=['GET', 'POST'])
def load(assignments=None, submissions=None, embed=False):
    editor_information = parse_assignment_load()
    return load_editor(editor_information)


def load_editor(editor_information):
    assignment = Assignment.by_id(editor_information['current_assignment_id'])
    position = editor_information['assignments'].index(assignment)
    if position is None:
        return "No assignment found for this user/course/assignment (maze game):"+repr(editor_information)
    if not editor_information['submissions']:
        return "No submission found for this user/course/assignment (maze game):"+repr(editor_information)

    return render_template('maze/maze.html', ip=request.remote_addr,
                           level=assignment.name,
                           submission=editor_information['submissions'][position],
                           assignment=assignment,
                           **editor_information)
