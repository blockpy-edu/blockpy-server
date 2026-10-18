#!/bin/sh
set -e

if [ "$DATABASE" = "postgres" ]
then
    echo "Waiting for postgres..."

    while ! nc -z $SQL_HOST $SQL_PORT; do
      sleep 0.1
    done

    echo "postgres started"
fi

# List of directories to create
DIRS="/usr/src/app/logs \
    /usr/src/app/data/uploads \
    /usr/src/app/data/uploads/submission_blocks \
    /usr/src/app/data/reports \
    /usr/src/app/static/gen \
    /usr/src/app/static/.webassets-cache \
    /usr/src/app/backups \
    /usr/src/app/instance \
    /usr/src/app/instance/certs"

# Create directories if they don't exist
for dir in $DIRS; do
    mkdir -p $dir
done

touch /usr/src/app/logs/blockpy_errors.log
touch /usr/src/app/logs/blockpy_events.log
touch /usr/src/app/logs/blockpy_tasks.log
touch /usr/src/app/logs/gunicorn_error.log
touch /usr/src/app/logs/gunicorn_access.log

# Ensure log files have correct ownership and permissions
# chown www-data:www-data /usr/src/app/logs/*.log
# chmod 664 /usr/src/app/logs/*.log

cd /usr/src/app

# export PGPASSWORD="$SQL_PASSWORD"

# Check if the database is already initialized by looking for an existing table
# DB_CHECK=$(psql -U "$SQL_USER" -h "$SQL_HOST" -d "$SQL_NAME" -tAc "SELECT to_regclass('public.submission_index');")

#FLAG_FILE="/usr/src/app/initialized.flag"

# If the table does not exist, initialize the database
# if [ -z "$DB_CHECK" ]; then
#if [ -f "$FLAG_FILE" ]; then
#  echo "Database already being initialized, skipping initialization."
#else
echo "Checking if the database needs to be created and seeded"
#touch "$FLAG_FILE"
python3 /usr/src/app/manage.py create_seeded_db
echo "Database ready"
# fi

# Start gunicorn (the production WSGI server; nginx proxies to port 8888).
# --timeout must exceed LTI_POST_TIMEOUT (config.py, 60 s): a grade post that waits on a slow
# LMS has to be able to time out and record its failure before the worker is killed.
exec gunicorn --chdir /usr/src/app -w 4 -b 0.0.0.0:8888 wsgi:application \
    --timeout 120 --graceful-timeout 30 \
    --error-logfile /usr/src/app/logs/gunicorn_error.log --access-logfile /usr/src/app/logs/gunicorn_access.log