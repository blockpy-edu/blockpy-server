"""
Flask Configuration File

Checks for a "secrets.json" file and uses that to add in private settings such as Secret Key.
"""
import os
from datetime import timedelta


class DefaultConfig:
    """
    General settings for all configurations
    """
    # Meta Site Data
    SITE_NAME = 'BlockPy Public'
    SYS_ADMINS = ['Unknown']
    SHOW_ABOUT_PAGE = True
    SITE_VERSION = 6
    PREFERRED_LOGIN_URL = None
    # Testing and Dev
    DEBUG = True
    TESTING = True
    PROFILE_RUNTIME = False
    # Filesystem settings
    ROOT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
    STATIC_DIRECTORY = os.path.join(ROOT_DIRECTORY, 'static')
    UPLOADS_DIR = os.path.join(STATIC_DIRECTORY, 'uploads')
    REPORT_DIR = os.path.join(STATIC_DIRECTORY, 'reports')
    BLOCKPY_LOG_DIR = os.path.join(ROOT_DIRECTORY, 'logs')
    TIMING_LOG_DIR = os.path.join(ROOT_DIRECTORY, 'logs', 'timing')
    ERROR_FILE_PATH = os.path.join(ROOT_DIRECTORY, 'logs', 'blockpy_errors.log')
    EVENTS_FILE_PATH = os.path.join(ROOT_DIRECTORY, 'logs', 'blockpy_events.log')
    TASKS_FILE_PATH = os.path.join(ROOT_DIRECTORY, 'logs', 'blockpy_tasks.log')
    CANVAS_DIR = os.path.join(STATIC_DIRECTORY, 'canvas', 'courses')
    API_DOCUMENTATION_PATH = "./models/generated/openapi.json"
    # Library Files
    LIB_PEDAL_DIR = os.path.join(STATIC_DIRECTORY, 'libs', 'pedal')
    LIB_CURRICULUM_CTVT_DIR = os.path.join(STATIC_DIRECTORY, 'libs', 'pedal')
    LIB_CURRICULUM_SNEKS_DIR = os.path.join(STATIC_DIRECTORY, 'libs', 'pedal')
    LIB_DESIGNER_DIR = os.path.join(STATIC_DIRECTORY, 'libs', 'designer')
    LIB_DRAFTER_DIR = os.path.join(STATIC_DIRECTORY, 'libs', 'drafter')
    LIB_BLOCKPY_DIR = os.path.join(STATIC_DIRECTORY, 'libs', 'blockpy')
    # External files settings
    BLOCKPY_SOURCE_DIR = None
    CORGIS_URL = "https://corgis-edu.github.io/corgis/datasets/"

    # Default App Settings
    # Maximum student code size (Defaults to 750kb)
    MAXIMUM_CODE_SIZE = 750 * 1024

    # Session settings
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'None'
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = True
    COOKIE_SAMESITE = 'None'

    # TODO: This is for API access with Canvas - nothing actually needs it yet.
    COURSE_TOKENS = os.path.join(ROOT_DIRECTORY, 'settings/course_tokens.yaml')

    # Debug toolbar settings
    DEBUG_TB_INTERCEPT_REDIRECTS = False

    # configured for Gmail by default
    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 465
    MAIL_USE_SSL = True
    SECURITY_EMAIL_SENDER = "BlockPy Administrator"

    # User Registration Stuff
    SECURITY_CONFIRMABLE = False
    SECURITY_REGISTERABLE = True
    SECURITY_RECOVERABLE = True
    SECURITY_CHANGEABLE = True
    SECURITY_TRACKABLE = True
    SECURITY_URL_PREFIX = '/users'
    SECURITY_POST_LOGIN_VIEW = "/blockpy"
    SECURITY_POST_CONFIRM_VIEW = "/blockpy"
    SECURITY_PASSWORD_HASH = 'bcrypt'
    SECURITY_DEFAULT_REMEMBER_ME = True
    # enforce CSRF protection for session / browser - but allow token-based
    # API calls to go through
    SECURITY_CSRF_PROTECT_MECHANISMS = ["session", "basic"]
    SECURITY_CSRF_IGNORE_UNAUTH_ENDPOINTS = True
    # Security settings
    CSRF_ENABLED = True
    WTF_CSRF_ENABLED = True
    # Send Cookie with csrf-token. This is the default for Axios and Angular.
    SECURITY_CSRF_COOKIE_NAME = "XSRF-TOKEN"
    WTF_CSRF_CHECK_DEFAULT = False
    WTF_CSRF_TIME_LIMIT = None

    # SQLAlchemy settings
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Flask JWT Extended
    # Need to check json/query_string for opening URLs on the page (JWT has to be passed manually)
    JWT_TOKEN_LOCATION = ["headers", "cookies", "json", "query_string"]
    JWT_COOKIE_SAMESITE = 'None'
    JWT_COOKIE_SECURE = True
    # If this is too low, could set to 30 days
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)

    # Task Settings
    TASK_DB_URI: str
    TASK_QUEUE_STYLE: str
    TASK_DB_SETTINGS: dict = {}

    # Logs
    ROTATE_LOGS = False

    # Force https URLs
    PREFERRED_URL_SCHEME = 'https'


class ProductionConfig(DefaultConfig):
    """
    General settings for production mode
    """
    DEBUG = False
    PORT = 5001
    TASK_QUEUE_STYLE = "redis"
    ROTATE_LOGS = True


class DevelopmentConfig(DefaultConfig):
    """
    General settings for local development
    """
    DEBUG = True
    HOST = 'localhost'
    SITE_ROOT_URL = 'localhost:5001'
    TASK_QUEUE_STYLE = 'sqlite'
    TASK_DB_URI = 'instance/tasks.db'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///../instance/main.db'
    SQLALCHEMY_DATABASE_URI_ALEMBIC = 'sqlite:///instance/main.db'


class TestConfig(DefaultConfig):
    """ Simple test config with in-memory database """
    TESTING = True
    HOST = 'localhost'
    SITE_ROOT_URL = 'localhost:5001'
    TASK_QUEUE_STYLE = 'sqlite'