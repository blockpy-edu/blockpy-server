from flask import current_app
from controllers.endpoints.basic import basic as blueprint_basic
from controllers.endpoints.courses import courses as blueprint_courses
from controllers.endpoints.assignments import blueprint_assignments
from controllers.endpoints.assignment_groups import blueprint_assignment_group
from controllers.endpoints.blockpy import blueprint_blockpy
from controllers.endpoints.maze import blueprint_maze
from controllers.endpoints.external import blueprint_external
from controllers.endpoints.grading import blueprint_grading
from controllers.quizzes import blueprint_quizzes
from controllers.endpoints.api import blueprint_api

def register_blueprints(app):
    app.register_blueprint(blueprint_basic)
    app.register_blueprint(blueprint_courses)
    app.register_blueprint(blueprint_assignments)
    app.register_blueprint(blueprint_assignment_group)
    app.register_blueprint(blueprint_blockpy)
    app.register_blueprint(blueprint_maze)
    app.register_blueprint(blueprint_external)
    app.register_blueprint(blueprint_grading)
    app.register_blueprint(blueprint_quizzes)
    app.register_blueprint(blueprint_api)


