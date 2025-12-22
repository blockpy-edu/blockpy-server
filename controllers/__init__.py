from controllers.setup import registry, rebar, generator

from controllers.auth import setup_authentication
from controllers.admin import setup_admin
from controllers.security import setup_security
from controllers.assets import setup_assets
from controllers.endpoints import register_blueprints
from controllers.errors import register_error_handlers

def create_blueprints(app):
    """
    Register all the routes of our project here.

    :param app: The main application context
    :return:
    """
    setup_authentication(app)
    setup_assets(app)
    setup_security(app)
    register_blueprints(app)
    setup_admin(app)
    register_error_handlers(app)
    rebar.init_app(app)
