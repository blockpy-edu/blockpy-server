import os

from quart import Quart
from flask_assets import Bundle, Environment
from webassets.filter import get_filter

es2015 = get_filter('babel', presets='es2015')

def get_bundles(app):
    return {
        'libs_js': Bundle(
            # NaturalSort
            'libs/naturalSort/naturalSort.js',
            # JQuery
            'libs/jquery/jquery-3.4.1.min.js',
            'libs/jquery/jquery-ui.min.js',
            'libs/jquery/jquery.multi-select.js',
            'libs/jquery/jquery.hotkeys.js',
            # Bootstrap
            'libs/bootstrap/popper.min.js',
            'libs/bootstrap/bootstrap.min.js',
            # Knockout
            'libs/knockout/knockout-3.5.0.js',
            # Highlight
            'libs/highlight/highlight.min.js',
            'libs/highlight/highlightjs-line-numbers.min.js',
            # Select2
            'libs/select2/select2.min.js',
            'libs/select2/knockout-select2.js',
            # EasyMDE
            'libs/easymde/easymde.min.js',
            # QR Code
            'libs/qrcode/qrcode.min.js',
            # CodeMirror
            'libs/codemirror/codemirror.js',
            'libs/codemirror/diff.js',
            'libs/codemirror/fullscreen.js',
            'libs/codemirror/markdown.js',
            'libs/codemirror/python.js',
            'libs/codemirror/java.js',
            'libs/codemirror/javascript.js',
            'libs/codemirror/shell.js',
            'libs/codemirror/yaml-frontmatter.js',
            'libs/codemirror/r.js',
            # Filepond
            'libs/filepond/filepond.min.js',
            # D3
            'libs/d3/d3.6.3.1.min.js',
            # Contodo
            'libs/contodo/contodo.iife.min.js',
            # TypeScript definitions
            'libs/typescript/raw_kettle_compiler_dts.js',
            # Doppio
            # TODO: Make this more conditional
            #"libs/doppio/js/base64.js",
            #"libs/doppio/js/util.js",
            #"libs/doppio/js/websock.js",
            # "libs/doppio/js/browserfs.min.js",
            #"libs/doppio/js/doppio.js",
            # Output
            output='gen/libs.js'
        ),

        'blockly_js': Bundle(
            "blockly/blockly_compressed.js",
            "blockly/blocks_compressed.js",
            "blockly/python_compressed.js",
            "blockly/msg/en.js",
            "blockly/field-multilineinput/index.js",
            # TODO: Probably should add some other languages
            output='gen/blockly.js'
        ),

        'skulpt_js': Bundle(
            "libs/skulpt/skulpt.js",
            "libs/skulpt/skulpt-stdlib.js",
            "libs/pygame4skulpt/pygameskulpt.js",
            output='gen/skulpt.js'
        ),

        # TODO: Extract these filepaths out to be config settings

        'pedal_js': Bundle(
            os.path.join(app.config['LIB_PEDAL_DIR'], "skulpt-pedal.js"),
            os.path.join(app.config['LIB_CURRICULUM_CTVT_DIR'], "skulpt-curriculum-ctvt.js"),
            os.path.join(app.config['LIB_CURRICULUM_SNEKS_DIR'], "skulpt-curriculum-sneks.js"),
            output='gen/pedal.js'
        ),

        'designer_js': Bundle(
            os.path.join(app.config['LIB_DESIGNER_DIR'], "skulpt-designer-files.js"),
            os.path.join(app.config['LIB_DESIGNER_DIR'], "skulpt-designer.js"),
            output='gen/designer.js'
        ),

        'drafter_js': Bundle(
            os.path.join(app.config['LIB_DRAFTER_DIR'], "skulpt-drafter.js"),
            output='gen/drafter.js'
        ),

        'blockpy_js': Bundle(
            "libs/block_mirror/block_mirror.js",
            #"libs/blockpy/blockpy.js",
            os.path.join(app.config['LIB_BLOCKPY_DIR'], "blockpy.js"),
            output='gen/blockpy.js'
        ),

        # 'doppio_js': Bundle(
        #     #"libs/doppio/js/ace.js",
        #     #"libs/doppio/js/mode-java.js",
        #     #"libs/doppio/js/theme-twilight.js",
        #     #"libs/doppio/js/dropbox.min.js",
        #     #"libs/doppio/js/jquery.min.js",
        #     #"libs/doppio/js/bootstrap.min.js",
        #     "libs/doppio/js/base64.js",
        #     "libs/doppio/js/util.js",
        #     "libs/doppio/js/websock.js",
        #     "libs/doppio/js/browserfs.min.js",
        #     "libs/doppio/js/doppio.js",
        #     #"libs/doppio/js/app.js",
        #     output="gen/doppio.js"
        # ),

        "doppio_css": Bundle(
            "libs/doppio/css/bitter.css",
            "libs/doppio/css/style.css",
            #"libs/doppio/css/bootstrap.min.css",
            "libs/doppio/css/xterm.css",
            # Output
            output='gen/doppio.css'
        ),

        'libs_css': Bundle(
            # FontAwesome
            'libs/fontawesome/all.min.css',
            # JQuery
            'libs/jquery/multi-select.css',
            # Bootstrap
            'libs/bootstrap/bootstrap.min.css',
            # Highlight
            'libs/highlight/default.min.css',
            # Select2
            'libs/select2/select2.min.css',
            # EasyMDE
            'libs/easymde/easymde.css',
            # CodeMirror
            'libs/codemirror/fullscreen.css',
            'libs/codemirror/codemirror.css',
            # jsoneditor
            'libs/jsoneditor/jsoneditor.css',
            # filepond
            'libs/filepond/filepond.min.css',
            # Output
            output='gen/libs.css'
        ),

        'blockpy_css': Bundle(
            "libs/block_mirror/block_mirror.css",
            os.path.join(app.config['LIB_BLOCKPY_DIR'], "blockpy.css"),
            output='gen/blockpy.css'
        ),

        'blockly_maze_css': Bundle(
            'blockly-games/common/common.css',
            'blockly-games/maze/style.css',
            output='gen/blockly_maze.css'),

        'blockly_maze_js': Bundle(
            'blockly-games/common/boot.js',
            'blockly-games/common/storage.js',
            output='gen/blockly_maze.js')
    }


def setup_assets(app: Quart) -> Environment:
    assets = Environment(app)
    assets.register(get_bundles(app))
    return assets
