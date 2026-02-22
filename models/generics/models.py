"""
All the most core components of the models, including the DB and the migrate.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_marshmallow import Marshmallow
from sqlalchemy.orm import sessionmaker

# Set up SQLAlchemy
db = SQLAlchemy()

# Set up Marshmallow
ma = Marshmallow()

# Set up Flask-Migrate
migrate = Migrate()

NonDurableSession = None

def init_non_durable_session(app):
    global NonDurableSession
    with app.app_context():
        NonDurableSession = sessionmaker(bind=db.engine, expire_on_commit=False, autoflush=False)

def get_non_durable_session():
    if NonDurableSession is None:
        raise Exception("NonDurableSession has not been initialized. Call init_non_durable_session(app) first.")
    return NonDurableSession()
