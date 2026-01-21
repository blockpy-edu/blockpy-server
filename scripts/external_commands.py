from shutil import copy
import os
import shutil

from quart import current_app
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
