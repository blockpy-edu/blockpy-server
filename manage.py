import os
import json

import click
from flask.cli import FlaskGroup
from flask_migrate import Migrate
from flask import current_app

from scripts.setup import cli
import scripts.db_commands
import scripts.external_commands
import scripts.import_eol


@cli.command('huey')
def run_huey():
    """
    Example command
    :return:
    """
    click.echo("Run the Huey server")
    huey = current_app.huey
    consumer = huey.create_consumer()
    consumer.run()


if __name__ == '__main__':
    cli()
