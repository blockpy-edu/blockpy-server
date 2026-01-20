# Blockpy Server

Flask-based server for managing the BlockPy LTI app. Its main responsibilities are:

* Managing the database of courses, users, assignments, submissions, and associated artifacts
* Providing the editor, particularly when launched from an LTI context
* Providing an interface for instructors to select assignments
* Grade passback to the LTI Tool Consumer (e.g., Canvas).
* Some basic course management features (CRUD operations for assignments, courses, etc.)

Ideally, students will never realize that BlockPy is a whole website standing apart from their LMS - it will seem like
an integrated part.
Teachers should be able to forget that BlockPy is separate as well, after they have added BlockPy as a new LTI App.
Administrators and researchers using BlockPy may find some of the other interfaces helpful.

# Requirements

This guide will go into more details about all the following, but here's a quick list of some of the things you're
going to end up needing to host your instance of BlockPy.

* A canvas installation (we have also had an integration with Moodle, although we do not try and support that since
  Moodle is a more limited LMS).
* The ability to add new LTI apps to your Canvas installation.
* A *nix server that can run BlockPy's server.
* An SSL certificate for the server.

Computationally, the server should not be a very demanding application.
Most of its work is to manage the database.
We did have some issues with scaling before we added some more indexes to the database, but ever since those
improvements we have been able to handle hundreds of concurrent users.
Since BlockPy's execution happens client-side, the difficulties are only:

1. Managing all the student submissions, which usually won't be very big "files". Once we figured out our indexes, we
   didn't have any issues even when we reached hundreds of thousands of submissions.
2. Managing all the logged data, which can be very big. We reached several gigs after a few years of use (several
   hundreds of students per semester). If you're concerned, please raise an Issue to have us add a feature to turn off
   logging optionally - it's not necessary to most use, but supports our research.
3. Communicating to Canvas through LTI. Grade passback happens when students submit, and this can take a second based on
   our timing logs. However, we have not had any recent issues with this even when hundreds of students were submitting.

# Docker Installation

The easiest way to get started with BlockPy is to use Docker.

If you don't have Docker installed, you can follow the instructions here: <https://docs.docker.com/engine/install/ubuntu/>

Once you have the project, you'll need to create a `instance/configuration.py` file.
First `cp instance/configuration.py.template` to `instance/configuration.py`
Then modify it with your own values!

You'll also need to make sure to set the nginx values for your server, the database settings, and so on.
You'll want to do:

```bash
$ cp conf/.env.dev.example .env
$ cp conf/.env.dev.db.example .env.db
```

And then modify their contents to match your server's settings.

You'll need to create a `static/public/` folder to host any large static public files,
like the videos from the Bakery curriculum.

The instructions below are how we used to setup the server. They're relatively up-to-date as
of the time of this writing, but they are the old-fashioned way.

# Installation from Scratch

Let's look at the steps involved in setting up BlockPy.

## Server Setup

We recommend hosting BlockPy
through [Nginx](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-18-04-quickstart) on a
Linux server. We have used both Ubuntu and CentOS without major issues. We used to use Apache, but that gave us a lot of
trouble.

The server will need to support SSL, so you should obtain an appropriate certificate. Some universities' or CS
departments' tech staff can help you get a certificate. Otherwise, you could also use a site like Let's Encrypt (
although we haven't tried that). For development, it is often sufficient to self-sign your certificates (on Windows, easiest to do this from Git Bash).

```bash
$ openssl genrsa -out certs/server.key 2048
$ openssl req -new -key certs/server.key -out certs/server.csr
$ openssl x509 -req -days 365 -in certs/server.csr -signkey certs/server.key -out certs/server.crt
$ cat certs/server.crt certs/server.key > certs/server.pem
```

You also need to setup the `ssl_dhparam` file:

```bash
$ openssl dhparam -out certs/dhparam.pem 2048
```

Make sure your server's firewall is configured to allow traffic for both HTTP and HTTPS. You may also need to configure
ports for mail, SSH, and external database access - however, none of these are really required for managing the server.
We usually use IPTables, so it's just a matter of adding the relevant rules. We recommend finding an appropriate guide.

## Get BlockPy Server

Choose an appropriate directory on your server to store the BlockPy server application. We
used `/var/www/blockpy-server` and `/home/www/blockpy-server/` but there are many options.

**Sidebar: Permissions** - We had some difficulty getting our permissions squared away when setting up our server
initially. Ignoring typos, the most common problem was forgetting that permissions needed to go up the entire folder
hierarchy. It wasn't enough to make `blockpy-server/` readable, we had to make its parent directories readable too.

You can download the server from our public GitHub repo:

```bash
$ git clone https://github.com/blockpy-edu/blockpy-server.git .
```

Using Git will allow you to pull in the inevitable bug fixes we'll be publishing.

## VirtualEnv

BlockPy's server is a Python 3.8+ Flask application, and it will eventually be run using a system called UWSGI. However,
you won't want to use your systems' Python version. Instead, you should use a Virtual Environment via VirtualEnv. There
are many tutorials for setting up a Virtual Env, such
as [this SO post](https://stackoverflow.com/questions/29934032/virtualenv-python-3-ubuntu-14-04-64-bit?answertab=active#tab-top).
We put our `venv/` folder directly in the `/var/www/blockpy-server/` folder.

Make sure you install the server's required libraries:

```bash
$ venv/bin/pip install -r requirements.txt
```

We also need UWSGI to daemonize the server:

```bash
$ venv/bin/pip install uwsgi
```

## Filesystem Directories

BlockPy's server has a few folders that it puts things in. Most of them can be created via the makefile:

```bash
$ make create_directories 
```

You will need to set permissions appropriately so that the web user (`nginx` or `www` or `www-data` depending on your
system) will be able to access them and in some cases write and execute them. If you are truly desperate, you can always
just `chmod 777` but we advise choosing permissions less liberally.

Here's a quick rundown of the folders:

* `instance/` - This is where we store the instance configuration file, which is used to override the default settings
  for local development and on the remote server.
* `instance/certs/` - This is where we store any local https certificates for local dev.
* `static/uploads/` - This is where we used to put user uploaded files - this may get used again in the future if the
  Postgres filesystem approach doesn't pan out.
* `static/uploads/submission_blocks/` - Images of students' block get uploaded here.
* `static/gen/` - The asset manager for Flask bundles JS and CSS, placing it here.
* `static/reports/` - This is where we store the reports generated by the server's async tasks module.
* `static/.webassets-cache/` - This is also involved in the asset bundling.
* `logs/` - This is where we store additional log files related to errors, events, access, etc.
* `backups/` - If you run the backup commands, data will be dumped here by default.
* ~~`settings/` - This is where we store the settings files, including the secrets file.~~ This is now deprecated, we rely on the `instance/` folder instead.
* ~~`database/` - This is where we store the SQLITE database for the local development version.~~ This is now deprecated, we store the local db in the `instance/` folder.

## Configuration

You're going to need to specify some settings for your server's installation.

You will need to create the file+folder `instance/configuration.py`.
This will override the default settings in `config.py` with your own settings.
You'll probably have very different settings for the local development version than for the production version.

Here's what your local development version might look like:

```python
"""
Local configuration
"""

SITE_NAME = "YOUR SITE NAME e.g., BlockPy @ Dev"
SYS_ADMINS = ["YOUR EMAIL ADDRESSES HERE"]

# Database settings
DATABASE_USER = "username for the database, if not sqlite"
DATABASE_PASS = "password for the database, if not sqlite"
DATABASE_URL = "postgresql://{username}:{password}@localhost/blockpy"
BUTLER_DATABASE_URL = "postgresql://butler:{password}@localhost/blockpy"

# Email settings
MAIL_SERVER = "smtp.gmail.com"
MAIL_USERNAME = "A GMAIL ACCOUNT"
MAIL_PASSWORD = "THAT ACCOUNT'S PASSWORD"
SECURITY_EMAIL_SENDER = "BlockPy Administrator @ UD"

# Secrets
JWT_SECRET_KEY = "Generate a random JWT secret key"
SECRET_KEY = "Generate a random Flask secret key"

# Certificates
CONSUMER_KEY = "Generate a random consumer key"
CONSUMER_KEY_SECRET = "Generate a random consumer secret"
CONSUMER_KEY_CERT = "instance/certs/server.key"
CONSUMER_KEY_PEM_FILE = "instance/certs/server.crt"
LOCAL_SSL_CERT = "instance/certs/server.crt"
LOCAL_SSL_KEY = "instance/certs/server.key"

# Password management
SECURITY_PASSWORD_SALT = "Generatea a random salt"

# External folders and files, if you are ever building these from source
BLOCKPY_SOURCE_DIR = "/local/path/to/blockpy/client"
DATASETS_SOURCE_DIR = "/local/path/to/corgis/datasets/"
# If you want to run Compare50 directly
COMPARE50_EXECUTABLE = "C:/Users/acbar/Projects/blockpy-server/venv/scripts/python -m compare50"
# If you want to rely on the publicly hosted Corgis Datasets
CORGIS_URL = "https://corgis-edu.github.io/corgis/datasets/"

# Library Filesystem settings, if you are ever building these from source
LIB_PEDAL_DIR = "../../pedal-edu/pedal/dist-js/"
LIB_CURRICULUM_CTVT_DIR = "../../pedal-edu/curriculum-ctvt/dist-js/"
LIB_CURRICULUM_SNEKS_DIR = "../../pedal-edu/curriculum-sneks/dist-js/"
LIB_DESIGNER_DIR = "../../gamedev/designer/dist-js/"
LIB_BLOCKPY_DIR = "../../blockpy-edu/blockpy/dist/"

# Debug Toolbar settings
DEBUG_TB_ENABLED = True
DEBUG_TB_PROFILER_ENABLED = True

# Admin User Information
ADMIN_USERNAME = "yourusername"
ADMIN_FIRST_NAME = "Your First Name"
ADMIN_LAST_NAME = "Your Last Name"
ADMIN_PASSWORD = "Your chosen password"
ADMIN_EMAIL = "youremailaddress@provider.domain"

# Profiling, can enable to get some performance data
PROFILE_RUNTIME = False
```

And then here's our heavily redacted production version:

```python
"""
Production configuration
"""
DEBUG = False
TESTING = False

SITE_NAME = "YOUR SITE NAME e.g., BlockPy @ Dev"
SYS_ADMINS = ["YOUR EMAIL ADDRESSES HERE"]

# Database settings
DATABASE_USER = "username for the database, if not sqlite"
DATABASE_PASS = "password for the database, if not sqlite"
DATABASE_URL = "postgresql://{username}:{password}@localhost/blockpy"
SQLALCHEMY_DATABASE_URI = DATABASE_URL.format(username=DATABASE_USER, password=DATABASE_PASS)

# Email settings
MAIL_SERVER = "INTERNAL MAIL SERVER"
MAIL_PORT = 25
MAIL_USE_SSL = False
MAIL_USERNAME = "noreply+blockpy@YOURSCHOOL.edu"
MAIL_PASSWORD = "YOUR MAIL PASSWORD"
SECURITY_EMAIL_SENDER = "BlockPy Administrator @ SCHOOL"

# Secrets
# Secrets
JWT_SECRET_KEY = "Generate a random JWT secret key"
SECRET_KEY = "Generate a random Flask secret key"

# Certificates
CONSUMER_KEY = "Generate a random consumer key"
CONSUMER_KEY_SECRET = "Generate a random consumer secret"
CONSUMER_KEY_CERT = "/full/path/server.key"
CONSUMER_KEY_PEM_FILE = "/full/path/server.pem"
LOCAL_SSL_CERT = "/full/path/server.crt"
LOCAL_SSL_KEY = "/full/path/server.key"

# Password management
SECURITY_PASSWORD_SALT = "Generatea a random salt"

# External folders and files
DATASETS_SOURCE_DIR = "/var/www/datasets/"
COMPARE50_EXECUTABLE = "/var/www/compare50/venv/bin/python3 -m compare50"
CORGIS_URL = "https://corgis-edu.github.io/corgis/datasets/"

# Debug Toolbar settings
DEBUG_TB_ENABLED = False
DEBUG_TB_PROFILER_ENABLED = False

# Admin User Information
ADMIN_USERNAME = "yourusername"
ADMIN_FIRST_NAME = "Your First Name"
ADMIN_LAST_NAME = "Your Last Name"
ADMIN_PASSWORD = "Your chosen password"
ADMIN_EMAIL = "youremailaddress@provider.domain"

# Task server
TASK_DB_PASSWORD = "redis password"
TASK_DB_URI = ""
TASK_DB_SETTINGS = {
  "password": TASK_DB_PASSWORD
}
TASK_QUEUE_STYLE = "redis"

# Profiling
PROFILE_RUNTIME = False

# Canvas settings to prevent folks from logging in normally off the firewall
# (they should use LTI)
PREFERRED_LOGIN_URL = "https://udel.instructure.com/"
```

Technically speaking, you could run your own version of CORGIS by changing the `CORGIS_URL`. However, you will probably
just want to use the general CORGIS Github instance. No further work is required on your end.

Your `CONSUMER_KEY` uniquely identifies you to Canvas, `CONSUMER_SECRET` is to be shared with instructors using your
BlockPy instance. The goal is to keep it relatively secretive. You can choose anything you want for your Key and Secret.

## Database setup

You're going to need to create a new Postgres database and prepopulate some schemas. Our database is named `blockpydb`.
You might want to adjust your authentication for Postgres too - we modified our `pg_hba.conf` file to require `md5`
instead of `ident`, for instance. Your exact database requirements may vary depending on whether you want to have other
tools on the server.

In addition to the database, you'll need to create a user (that you specified in the `instance/configuration.py` file) with
appropriate privileges. Basically, we ran the following commands through `psql` (you can also find these in `conf/db/init.sql`):

```postgresql
CREATE DATABASE blockpy;

CREATE USER blockpy WITH PASSWORD 'XXXX';

ALTER ROLE blockpy SET client_encoding TO 'utf8';

ALTER ROLE blockpy SET default_transaction_isolation TO 'read committed';

ALTER ROLE blockpy SET timezone TO 'UTC';

GRANT ALL PRIVILEGES ON DATABASE blockpy TO blockpy;

GRANT ALL ON ALL TABLES IN SCHEMA public TO blockpy;

\q
```

Assuming things have gone well so far, you should be able to run the following command line script to create the
relevant tables:

```bash
$ venv/bin/python manage.py create_db
```

You'll want to run any migrations to keep the schema in sync with our own:

```bash
$ venv/bin/python manage.py db upgrade
```

And the most basic default data can be added with:

```bash
$ venv/bin/python manage.py populate_db
```

You might want to add the maze course too, though we're hoping to make it its own separate curriculum.

```bash
$ venv/bin/python manage.py add_maze_course_db
```

In theory, you could now upload one of our curriculum's programming problems (e.g., PythonSneks or CT@VT). More
information on that coming soon! For now, you can create some rudimentary database items if you want:

```bash
$ venv/bin/python manage.py add_test_users_db
```

## Nginx Setup

You'll need to setup nginx with the right server settings. 
Check out the `conf/nginx/nginx.conf` file for a template.

* Make sure you adjust the `$ALLOW_IPS` to be whatever URLs you want to allow access to the login system (otherwise users will only log in through LTI).
* Adjust the `$SERVER_NAME` to be the URL of your server. It's in multiple places!
* Adjust the `$$CERTIFICATE_PEM_PATH` and `$CERTIFICATE_KEY_PATH` to be the paths to your SSL certificate and key.

For the `ssl_dhparam`, I don't have good notes on this, but this was part of what I did apparently. I'm not sure if it's redundant to your
external SSL certificate, but it might be used to set up outbound SSL communication?

```
> openssl dhparam 2048 -out /etc/nginx/cert/dhparam.pem
```

We also had a lot of headaches with permissions for `/run/uwsgi/blockpy.sock` particularly on server reloads. Keep an
eye on it and choose appropriate permissions for the users you choose.

You can test your Nginx sites with:

```bash
$ nginx -t
```

And reload them when they're ready:

```bash
$ nginx -s reload
```

## INI File Setup

You'll need to create a `uwsgi.ini` file to configure UWSGI; replace the `${BASE_DIR}` with the appropriate directory
if you have a different directory than `/var/www/blockpy-server/`.
We've included our `blockpy.ini` file for now as an example.

## UWSGI Setup

You'll need to register your UWSGI script with your server's `systemd` or equivalent. Here's
our `/etc/systemd/system/uwsgi.service` file:

```ini
[Unit]
Description = uWSGI Emperor service

[Service]
ExecStartPre=/bin/bash -c 'mkdir -p /run/uwsgi; chown -R www-data:www-data /run/uwsgi'
ExecStart=/var/www/blockpy-server/env/bin/uwsgi --emperor /etc/uwsgi/sites
Restart=always
KillSignal=SIGQUIT
Type=notify
NotifyAccess=all

[Install]
WantedBy=multi-user.target
```

This version demonstrates using Emperor mode, which is a bit more complicated but allows you to run multiple UWSGI
and handle restarting on crash. Alternatively, you can rely on Docker for all this.

Don't forget to start/restart UWSGI (you'll do this when pulling new versions of the github repo too):

```bash
$ sudo systemctl restart uwsgi
```

## Setup Redis

We use Redis to handle our asynchronous tasks.

Install Redis:

```bash
$ sudo apt-get update
$ sudo apt-get install redis
```

Edit the `/etc/redis/redis.conf` file to require a password and change the supervised to `systemd`.
Then, (re)start the Redis service.

```bash
$ sudo systemctl restart redis-server.service
```

You'll need to add your Tasks database password to `instance/configuration.py` (the URI should be an empty string).

Then you just need to set up the Huey service with systemd:

```bash
$ sudo nano /etc/systemd/system/huey.service
```

```ini
[Unit]
Description = Huey Service
After = redis.service

[Service]
User = www-data
Group = www-data
WorkingDirectory = /var/www/blockpy-server/
ExecStart = /var/www/blockpy-server/env/bin/python3 manage.py huey
Restart = always

[Install]
WantedBy = multi-user.target
```

```bash
$ sudo systemctl restart huey
```

And you should now be able to have long-running asynchronous background tasks!

## Large public files

BlockPy has some large public files that it serves. You'll need to create a `static/public/` folder to host these files.
The docker image will map these to the `/var/www/public/` folder.
Alternatively, you can just host these files in the `/var/www/public` folder directly, and then adjust your Nginx
configuration to serve them.
We use this for the videos in the Bakery curriculum.
This avoids making BlockPy's python server handle the large files.

# Using BlockPy

At this point, in theory, your instance is now publicly accessible from the browser. If not, google and our Issue
tracker are your friends :)

Let's talk about how to actually use this thing.

## Adding Instructors

Students are automatically registered in Canvas, but instructors should register separately. In theory, this can all be
done with BlockPy's Register and Login buttons. However, I broke the email server and haven't been able to test them
recently. Please raise an Issue if you have trouble!

Once you're in the system and confirmed, you can create courses. Roles are taken from Canvas. Note that this means a
student with appropriate Canvas permissions could create their own course and become an instructor. Keep an eye on
ownership of assignments and roles within courses.

## Configuring Canvas

You connect to your BlockPy instance from Canvas via the LTI protocol. This requires you to register your BlockPy
instance in your course. The recommended approach is to use the XML configuration file generated for your instance
automatically. You can get your XML file and other settings by visiting the Courses page. For us, the URL
is: `https://think.cs.vt.edu/blockpy/courses/add_canvas`

With your settings and XML file, you can follow [this guide](https://community.canvaslms.com/docs/DOC-12863-415274552)to
add BlockPy to your Canvas installation. There are also some brief instructions on the BlockPy Add Canvas page that you
can link instructors to.

## Adding assignments

The Courses page has a link to another page with instructions for building new assignments and selecting resources. For
us, the url is: `https://think.cs.vt.edu/blockpy/courses/making_problems/`

Unfortunately, this guide is slightly out of date. We'll update it soon once we finish the revised assignment editing
interface.

If you're using our curriculum, you might never use these menus. But please do know that BlockPy has a very rich system
for building assignments. In particular, we use [Pedal](https://github.com/pedal-edu/pedal/) to provide feedback.

## Trying Assignments

When you open an assignment as an instructor, you are editing its settings. You can try out the problem, but grades
aren't passed anywhere. You probably want to use the Student View to more accurately model what students will
experience. You should verify that you can successfully submit a grade with this, to check that you have your LTI
permissions enabled correctly.

Using the BlockPy Editor is outside the scope of this document. If you have issues with the Editor, please feel free to
report them in our Issue tracker, either for the [server](https://github.com/blockpy-edu/blockpy-server/issues) or for
the [client](https://github.com/blockpy-edu/blockpy/issues/).

## Dashboard

This feature isn't ready, but will eventually provide an interface for instructors and students to view submissions (and
eventually to provide comments and feedback).

# Getting Help

Filing a GitHub Issue is the best way for us to help track and resolve trouble you're having. Please understand that we
are a small team (mostly just Dr. Bart) with other responsibilities. We will try to fix show-stopper issues as quickly
as possible.

# Development

## Big Jan 2024 Update

We've rewritten huge chunks of the project. If you have an older version of BlockPy, you'll need to update your database.

The following commands are used to update the database to handle the change to Flask-Security-Too:

```sql
-- SQLite version
alter table "user" add fs_uniquifier VARCHAR(64) NOT NULL default hex(randomblob(64));
-- Postgres version
alter table "user" add fs_uniquifier VARCHAR(64) NOT NULL default concat(md5(random()::text), md5(random()::text));

-- Might need to run this too on sqlite? Not sure according to my notes 
UPDATE "user" SET fs_uniquifier=hex(randomblob(64));

create unique index user_fs_uniquifier_index on "user" (fs_uniquifier);

alter table "role" add description TEXT;
```

<https://flask-security-too.readthedocs.io/en/stable/changelog.html#id32>

Courses can now be locked, which requires the following new field:

```sql
alter table "course" add locked BOOLEAN NOT NULL default FALSE;
```

The submissions now track when they are submitted, graded, and due:

```sql
alter table submission add date_submitted timestamp without time zone default NULL;

alter table submission add date_graded timestamp without time zone default NULL;

alter table submission add date_due timestamp without time zone default NULL;

alter table submission add date_locked timestamp without time zone default NULL;




```

Need to create a `GradeHistory` table:

```sql
create table grade_history (     id             integer not null         primary key,     date_created   datetime,     date_modified  datetime,     submission_id  integer not null         references submission,     grader_id      integer         references user,     score          integer,     date_submitted datetime );

create table grade_history
(
    id             integer not null
        primary key,
    date_created   datetime,
    date_modified  datetime,
    submission_id  integer not null
        references submission,
    grader_id      integer
        references user,
    score          integer,
    date_submitted datetime
);

create index grade_history_submission_id_index on grade_history (submission_id);

```

And some other indexes:

```sql
CREATE INDEX authentication_lookup ON authentication (type, value);
CREATE INDEX CONCURRENTLY log_assignment_index ON "log" (assignment_id);
CREATE INDEX review_submission_index ON "review" (submission_id);
```
