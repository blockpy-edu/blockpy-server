set quiet


export FLASK_APP := "main.py"
export FLASK_ENV := "development"
export FLASK_DEBUG := "1"

default:
    just --list --unsorted

serve:
    python -m flask run --cert instance/certs/server.crt --key instance/certs/server.key

huey:
    python manage.py --debug huey

frontend:
    cd frontend && npm run watch

[parallel]
dev: serve huey frontend