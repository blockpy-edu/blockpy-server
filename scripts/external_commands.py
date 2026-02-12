from shutil import copy
import os
import shutil

from flask import current_app, render_template_string
import click

from scripts.setup import cli


RELATIVE_SOURCE_FILES = {
    'dist/blockpy.js': 'libs/blockpy/',
    'dist/blockpy.css': 'libs/blockpy/',
    '../blockmirror/dist/block_mirror.js': 'libs/block_mirror/',
    '../blockmirror/dist/block_mirror.css': 'libs/block_mirror/',
    '../skulpt/dist/skulpt.js': 'libs/skulpt/',
    '../skulpt/dist/skulpt-stdlib.js': 'libs/skulpt/',
    '../pygame4skulpt/dist/pygameskulpt.js': 'libs/pygame4skulpt/',
    '../../pedal-edu/pedal/dist-js/skulpt-pedal.js': 'libs/pedal/',
    '../../pedal-edu/curriculum-ctvt/dist-js/skulpt-curriculum-ctvt.js': 'libs/pedal/',
    '../../pedal-edu/curriculum-sneks/dist-js/skulpt-curriculum-sneks.js': 'libs/pedal/',
    '../../gamedev/designer/dist-js/skulpt-designer.js': 'libs/designer/',
    '../../gamedev/designer/dist-js/skulpt-designer-files.js': 'libs/designer/',
    '../../drafter-edu/drafter/dist-js/skulpt-drafter.js': 'libs/drafter/',
    # '../blockly/blockly_uncompressed.js': 'blockly/',
    # '../blockly/blockly_compressed.js': 'blockly/',
    # '../blockly/blocks_compressed.js': 'blockly/',
    # '../blockly/python_compressed.js': 'blockly/',
    # '../blockly/msg/js/en.js': 'blockly/msg/js/'
}


@cli.command("update_sources")
@click.option('--directory', '-d', 'source_directory', default=None)
def update_sources(source_directory):
    if source_directory is None:
        source_directory = current_app.config['BLOCKPY_SOURCE_DIR']
    static_directory = current_app.config['STATIC_DIRECTORY']

    click.echo(f"Updating Source files from {source_directory} to {static_directory}")
    with click.progressbar(RELATIVE_SOURCE_FILES.items()) as bar:
        for source_file, target_directory in bar:
            bar.update(1, source_file)
            final_source = os.path.join(source_directory, source_file)
            final_target = os.path.join(static_directory, target_directory)
            copy(final_source, final_target)


@cli.command("send_unanswered_posts_digest")
@click.option('--course-ids', '-c', 'course_ids', default=None,
              help="Comma-separated list of course IDs to check (default: all active courses)")
@click.option('--dry-run', '-d', is_flag=True, 
              help="Print digest without sending emails")
def send_unanswered_posts_digest(course_ids, dry_run):
    """
    Send an email digest of unanswered posts to course staff.
    
    This command:
    1. Queries for all unanswered posts in specified courses
    2. Groups them by course
    3. Sends a digest email to all instructors in each course
    """
    from models import db
    from models.post import Post
    from models.course import Course
    from models.role import Role
    from models.user import User
    from models.enums import PostStatus, RolePermissions
    from flask_mail import Message
    from mailing import mail
    
    click.echo("=" * 60)
    click.echo("Unanswered Posts Digest")
    click.echo("=" * 60)
    
    # Determine which courses to check
    if course_ids:
        course_id_list = [int(cid.strip()) for cid in course_ids.split(',')]
        courses = Course.query.filter(Course.id.in_(course_id_list)).all()
    else:
        # Get all non-archived courses
        courses = Course.query.filter(Course.visibility != 'archived').all()
    
    if not courses:
        click.echo("No courses found.")
        return
    
    click.echo(f"Checking {len(courses)} course(s) for unanswered posts...")
    click.echo()
    
    total_posts = 0
    emails_to_send = []
    
    # Process each course
    for course in courses:
        # Get unanswered posts in this course
        unanswered_posts = Post.query.filter(
            Post.course_id == course.id,
            Post.is_answered == False,
            Post.status == PostStatus.OPEN
        ).order_by(Post.date_created.asc()).all()
        
        if not unanswered_posts:
            continue
        
        total_posts += len(unanswered_posts)
        
        click.echo(f"Course: {course.name} ({course.id})")
        click.echo(f"  Unanswered posts: {len(unanswered_posts)}")
        
        # Get course instructors
        instructor_roles = Role.query.filter(
            Role.course_id == course.id,
            Role.role.in_([RolePermissions.INSTRUCTOR, RolePermissions.OWNER])
        ).all()
        
        instructors = [role.user for role in instructor_roles]
        instructor_emails = [inst.email for inst in instructors if inst.email]
        
        if not instructor_emails:
            click.echo("  No instructor emails found, skipping.")
            continue
        
        click.echo(f"  Recipients: {', '.join(instructor_emails)}")
        
        # Prepare email content
        email_body = f"""
<h2>Unanswered Student Questions in {course.name}</h2>

<p>There are {len(unanswered_posts)} unanswered question(s) from students in your course.</p>

<h3>Unanswered Posts:</h3>
<ul>
"""
        
        for post in unanswered_posts:
            author_name = post.author.name() if post.author else "Unknown"
            post_url = f"{current_app.config.get('SITE_URL', 'http://localhost:5000')}/courses/posts/{post.id}"
            
            email_body += f"""
<li>
    <strong>{post.title}</strong> by {author_name}<br/>
    Asked: {post.date_created.strftime('%Y-%m-%d %H:%M UTC')}<br/>
"""
            if post.assignment_id:
                email_body += f"    Assignment: {post.assignment.name if post.assignment else 'N/A'}<br/>\n"
            
            email_body += f"""    <a href="{post_url}">View and Answer</a>
</li>
"""
        
        email_body += """
</ul>

<p>Please log in to BlockPy to view and answer these questions.</p>
"""
        
        # Create email message
        msg = Message(
            subject=f"[BlockPy] {len(unanswered_posts)} Unanswered Question(s) in {course.name}",
            recipients=instructor_emails,
            html=email_body
        )
        
        emails_to_send.append((course.name, msg, instructor_emails))
        click.echo()
    
    # Summary
    click.echo("=" * 60)
    click.echo(f"Total unanswered posts: {total_posts}")
    click.echo(f"Emails to send: {len(emails_to_send)}")
    
    if dry_run:
        click.echo()
        click.echo("DRY RUN - No emails will be sent")
        click.echo("=" * 60)
        return
    
    # Send emails
    if emails_to_send:
        click.echo()
        click.echo("Sending emails...")
        
        sent_count = 0
        failed_count = 0
        
        for course_name, msg, recipients in emails_to_send:
            try:
                with current_app.app_context():
                    mail.send(msg)
                click.echo(f"  ✓ Sent digest for {course_name} to {len(recipients)} recipient(s)")
                sent_count += 1
            except Exception as e:
                click.echo(f"  ✗ Failed to send digest for {course_name}: {e}")
                failed_count += 1
        
        click.echo()
        click.echo(f"Successfully sent: {sent_count}")
        if failed_count:
            click.echo(f"Failed: {failed_count}")
    else:
        click.echo("No emails to send.")
    
    click.echo("=" * 60)
