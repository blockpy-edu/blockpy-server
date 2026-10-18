###########
# BUILDER #
###########

FROM python:3.11  as builder
USER root
RUN apt-get update && apt-get install -y python3-dev \
                      build-essential \
                      libc-dev \
                      netcat-traditional \
                      libpq-dev \
                      gcc

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Create virtual environment
RUN python3 -m venv /usr/src/app/venv

# install dependencies
RUN /usr/src/app/venv/bin/pip install --upgrade pip
RUN /usr/src/app/venv/bin/pip install psycopg2
COPY ./requirements.txt .
RUN /usr/src/app/venv/bin/pip wheel --no-cache-dir --no-deps --wheel-dir /usr/src/app/wheels -r requirements.txt


#########
# FINAL #
#########
FROM python:3.11

# Install the system packages the app and its entrypoint need (gunicorn itself comes from requirements.txt)
RUN apt-get update && apt-get install -y netcat-traditional  \
    htop gettext-base less \
    python3-dev libc-dev libpq-dev gcc postgresql-client \
    curl

# Create a list of directories and iterate over it to create them
RUN DIRS="/usr/src/app/logs \
    /usr/src/app/data/uploads \
    /usr/src/app/data/uploads/submission_blocks \
    /usr/src/app/data/reports \
    /usr/src/app/static/gen \
    /usr/src/app/static/.webassets-cache \
    /usr/src/app/static/public \
    /usr/src/app/backups \
    /usr/src/app/instance \
    /usr/src/app/instance/certs" \
    && for dir in $DIRS; do \
        mkdir -p $dir; \
        chown www-data:www-data $dir; \
        chmod 775 $dir; \
    done

# install dependencies
COPY --from=builder /usr/src/app/wheels /wheels
COPY --from=builder /usr/src/app/requirements.txt .
RUN pip install psycopg2
RUN pip install --no-cache /wheels/*

# BlockPy's server has a few folders that it puts things in. 
# Most of them can be created via the makefile:
# add app
COPY --chown=www-data:www-data . /usr/src/app

# Copy the entrypoint script (it starts gunicorn; see conf/entrypoint.sh)
COPY ./conf/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# chown all the files to the app user
#RUN chmod -R 775 /usr/src/app
#RUN chown -R www-data:www-data /usr/src/app

# change to the app user
USER www-data


# run entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
