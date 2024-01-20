import datetime
import random
import os
import json
from pprint import pprint

import click
from flask import current_app
from sqlalchemy import text as sqla_text

from models import db
from models.generics.base import find_all_linked_resources, SAFE_DELETE_ORDER
from scripts.setup import cli


@cli.command("create_db")
def create_db():
    """Creates the database tables"""
    click.echo("Creating database tables")
    db.engine.echo = True
    r = db.create_all()
    click.echo(r)


@cli.command("reset_db")
def reset_db():
    """Drops all tables and recreates them"""
    click.echo("This will delete all existing tables and recreate them. You will lose all existing data.")
    if click.confirm("Do you want to continue?"):
        click.echo("Dropping database tables")
        db.drop_all()
        click.echo("Creating database tables")
        db.create_all()


@cli.command("populate_db")
def populate_db():
    """ Fills in predefined data into DB """
    from models.user import User
    from models.course import Course
    from models.role import Role

    if not click.confirm("This may delete existing data. Are you sure you want to continue?"):
        click.echo("Aborting!")
        return

    secrets = current_app.config

    click.echo(f"Adding Admin User: {secrets.get('ADMIN_EMAIL', 'admin')}")
    admin = User.new_admin(secrets.get("ADMIN_EMAIL", "email@whatever.com"),
                           secrets.get("ADMIN_FIRST_NAME", "Admin"),
                           secrets.get("ADMIN_LAST_NAME", "User"),
                           secrets.get("ADMIN_PASSWORD", "password"))
    db.session.add(admin)
    db.session.flush()
    db.session.add(Role(name='instructor', user_id=admin.id))
    db.session.add(Role(name='admin', user_id=admin.id))

    click.echo("Adding default course")
    default_course = Course(name="Default Course", owner_id=admin.id,
                            service="native",
                            url="default", visibility='public')
    db.session.add(default_course)
    db.session.flush()
    db.session.add(Role(name='instructor', course_id=default_course.id, user_id=admin.id))

    db.session.commit()
    click.echo("Populated database")


@cli.command("add_maze_course")
@click.option('--owner', '-o', 'owner_id', default='1')
def add_maze_course(owner_id):
    from models.user import User
    from models.course import Course
    from models.role import Role
    from models.assignment import Assignment
    from models.assignment_group import AssignmentGroup
    from models.assignment_group_membership import AssignmentGroupMembership

    click.echo("Adding Maze Course")

    owner_id = int(owner_id)
    maze_course = Course.new('Maze Course', owner_id, 'public', '', 'maze')

    maze_group = AssignmentGroup.new(owner_id, maze_course.id, "Maze Game")

    for level in range(10):
        maze_level = Assignment.new(owner_id, maze_course.id, 'maze', level=str(1 + level))
        db.session.add(maze_level)
        db.session.flush()
        membership = AssignmentGroupMembership.move_assignment(maze_level.id, maze_group.id)
        db.session.add(membership)
    db.session.commit()
    click.echo("Added Maze Course")


@cli.command("add_test_user")
def add_test_user():
    """Adds a test user to the database"""
    from models.user import User
    from models.course import Course
    from models.role import Role
    from models.assignment_group import AssignmentGroup
    from models.assignment_group_membership import AssignmentGroupMembership
    from models.assignment import Assignment

    default_course = Course.query.first()

    click.echo("Adding Teacher")
    teacher = User.new_from_instructor("klaus@acbart.com", "Klaus", "Bart", "password")
    db.session.add(teacher)
    db.session.flush()
    db.session.add(Role(name='instructor', course_id=default_course.id, user_id=teacher.id))

    click.echo("Adding Student")
    student = User.new_from_instructor("ada@acbart.com", "Ada", "Bart", "password")
    db.session.add(student)
    db.session.flush()
    db.session.add(Role(name='student', course_id=default_course.id, user_id=student.id))

    click.echo("Adding basic assignments")
    basic_group = AssignmentGroup(name="First Group", course_id=default_course.id, owner_id=teacher.id,
                                  url="test_assignment_group")
    db.session.add(basic_group)
    db.session.flush()
    for i in range(5):
        assignment = Assignment(name="Problem {}".format(i), instructions="Complete this problem",
                                owner_id=teacher.id, course_id=default_course.id,
                                url=f"test_problem_{i}", group_id=basic_group.id)
        db.session.add(assignment)
        db.session.flush()
        db.session.add(AssignmentGroupMembership(assignment_group_id=basic_group.id,
                                                 assignment_id=assignment.id))

    db.session.commit()
    click.echo("Complete")


@cli.command("export_course")
@click.option('--file', '-f', 'course_data_path', default='backups/current_course_data.json')
@click.option('--course', '-c', 'course_id', default='1')
def export_course(course_id, course_data_path):
    """Exports a course to a JSON file"""
    from models.course import Course
    exported_data = Course.export(int(course_id))
    with open(course_data_path, 'w') as output_file:
        json.dump(exported_data, output_file, indent=2, sort_keys=True)
    click.echo("Exported course")


@cli.command("import_course")
@click.option('--file', '-f', 'course_data_path', default='backups/current_course_data.json')
@click.option('--course', '-c', 'course_id', default='1')
def import_course(owner_id, course_data_path):
    """Imports a course to a JSON file"""
    from models.course import Course
    with open(course_data_path, 'r') as input_file:
        imported_data = json.load(input_file)
    Course.import_json(imported_data, int(owner_id))
    click.echo("Imported course")


@cli.command("delete_course")
@click.option("--course", '-c', "course_id")
def delete_course(course_id):
    """Deletes a specific course"""
    from models.course import Course
    if click.confirm("Are you sure you want to delete this course?"):
        Course.remove(int(course_id), True)


def dump_rows(rows, output, table_name):
    data = [{c.name: str(getattr(row, c.name))
             for c in row.__table__.columns}
            for row in rows]
    full_path = os.path.join(output, table_name + '.json')
    with open(full_path, 'w') as output_file:
        json.dump(data, output_file)

def _log_for_course(course, output):
    from models.log import Log
    logs = Log.get_logs_for_course(course)
    dump_rows(logs, output, 'log')

@cli.command("dump_db")
@click.option('--output', '-o', 'output', default='backups/db/')
@click.option('--log_for_course', '-l', 'log_for_course', default=None)
def dump_db(output, log_for_course):
    if log_for_course:
        return _log_for_course(log_for_course, output)
    from models.assignment_group_membership import AssignmentGroupMembership
    from models.user import User
    from models.course import Course
    from models.role import Role
    from models.authentication import Authentication
    from models.log import Log
    from models.submission import Submission
    from models.assignment import Assignment
    from models.assignment_group import AssignmentGroup
    tables = {
        'user': User,
        'course': Course,
        'submission': Submission,
        'assignment': Assignment,
        'group': AssignmentGroup,
        'membership': AssignmentGroupMembership,
        'authentication': Authentication,
        'log': Log,
        'role': Role
    }
    for table_name, table_class in tables.items():
        dump_rows(table_class.query.all(), output, table_name)


@cli.command("export_progsnap2")
@click.option('--output', '-o', 'output', default='backups/progsnap2_{}')
@click.option('--log_for_course', '-l', 'log_for_course', default=1)
@click.option('--groups', '-g', 'groups', default=None)
@click.option("--exclude", '-e', "exclude", default=None)
@click.option('--format', '-f', 'format', default='csv',
              type=click.Choice(['csv', 'sqlite']),
              help="csv is zipped csv, sqlite is a SQLite db")
@click.option('--overwrite', '-w', 'overwrite', default=False, is_flag=True)
@click.option("--partition", '-p', "partition", default=None,
              help="How many user partitions to make", type=int)
def export_progsnap2(output, log_for_course, groups, exclude, format, overwrite, partition,):
    from models.portation import export_progsnap2
    if groups is not None:
        output = output + "_{}".format(groups.replace(",", "_"))
        groups = [int(g) for g in groups.split(",")]
    if exclude is not None:
        output = output + "_x{}".format(exclude.replace(",", "_"))
        exclude = [int(g) for g in exclude.split(",")]
    export_progsnap2(output.format(log_for_course), log_for_course, groups, exclude=exclude, log=True, format=format, overwrite=overwrite, partition=partition)


@cli.command("clear_old_anonymous_users")
@click.option("--days", '-d', "days", default=7,
              help="How old the users must be (in days) before they are eligible")
@click.option("--keep_active", '-a', "keep_active", default=True,
              help="Do not remove users who have Logs or recent submissions")
@click.option("--limit", "-l", "limit", default=None,
              help="Limit the number of users to delete")
def clear_old_anonymous_users(days, keep_active, limit):
    """
    Removes any old users that are anonymous, along with their linked data.
    Old is determined by when the user is created.

    Select all anonymous users who have been in the system for more than 1 week
    Count how many there are, report in buckets.
    Indicate how many resources they have.

    Check that the admin wants to do this action. If so, then...
    Delete their authentication, their logs, their submissions, everything they own.
    Return the number of users who were deleted
    """
    click.echo("Finding all old anonymous users")
    from models.user import User

    anonymous_users = User.get_old_anonymous_users(int(days), limit=limit)
    click.echo(f"Found {len(anonymous_users)} anonymous old users")

    if keep_active:
        old_count = len(anonymous_users)
        click.echo(f"Keeping users who are active in the last {days} days")
        with click.progressbar(anonymous_users) as bar:
            anonymous_users = [user for user in bar if not user.has_activity(days)]

        if old_count == len(anonymous_users):
            click.echo("All of these users were inactive.")
        else:
            click.echo(f"Filtered down to {len(anonymous_users)} with no activity")

    click.echo("Finding all linked resources that would need to be deleted first...")
    combined_resources = {}
    skipped_users = set()
    with click.progressbar(anonymous_users) as bar:
        for anonymous_user in bar:
            # Find all things that would cry if we deleted this
            resource_graph = find_all_linked_resources([anonymous_user])
            # If any user is not in the anonymous user, this is not safe to delete
            if any(user not in anonymous_users
                   for user in resource_graph.get('User', [])):
                skipped_users.add(anonymous_user)
                continue
            for category, resources in resource_graph.items():
                combined_resources.setdefault(category, set()).update(resources)
    if skipped_users:
        click.echo(f"Skipped {len(skipped_users)} users because non-anonymous users are depending on their resources.")
        if click.confirm("Would you like to see the users?"):
            click.echo("These users are anonymous, but have non-anonymous users depending on them.")
            for user in skipped_users:
                click.echo(f"    {user}")
        click.echo("")

    click.echo("Found the following resources:")
    total = 0
    for category, resources in combined_resources.items():
        if resources:
            click.echo(f"    {category}s: {len(resources)}")
            total += len(resources)
    click.echo(f"Total Resources: {total}")

    if not total and not anonymous_users:
        click.echo("No users or resources to delete!")
        return

    # Check to make sure that all the referred users are anonymous
    if not click.confirm("Are you sure you want to delete the users and their resources?"):
        click.echo("Aborting!")
        return

    click.echo(f"Deleting resources...")
    total = 0
    for category in SAFE_DELETE_ORDER:
        if category in combined_resources:
            with click.progressbar(combined_resources[category]) as bar:
                for resource in bar:
                    db.session.delete(resource)
                    total += 1
    db.session.commit()
    click.echo(f"Deleted {total} resources")

    click.echo(f"Deleting users...")
    total = 0
    if current_app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql'):
        db.session.execute(sqla_text("SET session_replication_role='replica';"))
        db.session.commit()
    with click.progressbar(anonymous_users) as bar:
        for user in bar:
            db.session.delete(user)
            total += 1
    db.session.commit()
    if current_app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql'):
        db.session.execute(sqla_text("SET session_replication_role='origin';"))
        db.session.commit()
    click.echo(f"Deleted {total} users")

    click.echo("Done!")
