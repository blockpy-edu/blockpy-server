# Built-ins
import json
import os

# Flask
from common.flask_extensions import CustomFlask
from flask import Flask
from flask_debugtoolbar import DebugToolbarExtension
from flask_jwt_extended import JWTManager


def create_app(test_config=None, instance_config="configuration.py") -> Flask:
    """
    Per the App Factory pattern, this creates a new instance of the BlockPy app.
    :param test_config: 'testing' for unit tests, or a specific config object.
    :return: a new instance of the BlockPy app.
    """
    # create and configure the app
    instance_path = os.path.join(os.path.dirname(__file__), './instance')
    app = CustomFlask('blockpy', instance_relative_config=True, static_folder='static',
                instance_path=instance_path)
                #static_url_path='/static')
    # load the test config if passed in
    if test_config is not None:
        if test_config == 'testing':
            print("Loading TestConfig")
            app.config.from_object('config.TestConfig')
        else:
            print("Loading custom test config")
            app.config.from_mapping(test_config)
    elif app.config['DEBUG']:
        app.config.from_object('config.DevelopmentConfig')
    else:
        print("Loading Production!")
        app.config.from_object('config.ProductionConfig')

    # Load the instance config, if it exists
    if isinstance(instance_config, dict):
        if '_BASE_FILE' in instance_config:
            base_file = instance_config['_BASE_FILE']
            print(f"Loading base instance configuration from {base_file!r}")
            app.config.from_pyfile(base_file)
            del instance_config['_BASE_FILE']
        print("Loading instance configuration from dict")
        app.config.from_mapping(instance_config)
    else:
        print(f"Loading instance configuration from {instance_config!r}")
        app.config.from_pyfile(instance_config)

    # Additional settings being overridden here
    app.config['TEMPLATES_AUTO_RELOAD'] = True

    # Turn on profiler if necessary
    if app.config['PROFILE_RUNTIME']:
        from werkzeug.middleware.profiler import ProfilerMiddleware
        app.wsgi_app = ProfilerMiddleware(app.wsgi_app, stream=None,
                                          profile_dir=app.config['TIMING_LOG_DIR'],
                                          filename_format='{method}.{path}.{elapsed:.0f}ms.{time:.0f}.pstat')

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Load up the database
    # TODO: Finish init_database
    from models import init_database
    init_database(app)

    from tasks.setup import setup_tasks
    huey = setup_tasks(app.config['TASK_QUEUE_STYLE'],
                       app.config['TASK_DB_URI'],
                       app.config['TASK_DB_SETTINGS'])
    app.huey = huey

    # Turn on Debug Toolbar
    app.debug_toolbar = DebugToolbarExtension(app)

    # Set Up JWT
    jwt = JWTManager(app)

    # Email
    from mailing import setup_mail
    setup_mail(app)

    # Set up all the endpoints
    with app.app_context():

        # Modify Jinja2
        from controllers.jinja_filters import setup_jinja_filters
        setup_jinja_filters(app)

        # Logging
        from controllers.interaction_logger import setup_logging
        setup_logging(app)

        # Load up all the controllers
        from controllers import create_blueprints
        create_blueprints(app)
        print("Loaded all endpoints successfully!")

    return app
