"""
Any of the basic app pages, like the site-map and the about page.
"""
import os
from urllib.parse import unquote

from flask import render_template, current_app, send_from_directory, url_for, Blueprint

basic = Blueprint('basic', __name__)


@basic.route('/', methods=['GET', 'POST'])
def index():
    """
    The main index page.

    :return: index page for the entire app
    """
    return render_template('index.html')


@basic.route('/about/', methods=['GET', 'POST'])
@basic.route('/about', methods=['GET', 'POST'])
@basic.route('/public/', methods=['GET', 'POST'])
@basic.route('/public', methods=['GET', 'POST'])
@basic.route('/contact/', methods=['GET', 'POST'])
@basic.route('/contact', methods=['GET', 'POST'])
def about():
    """
    Information about the various projects.
    """
    return render_template('about.html')


@basic.route('/favicon.ico', methods=['GET', 'POST'])
def favicon():
    return send_from_directory(os.path.join(current_app.root_path, 'static'),
                               'favicon.ico',
                               mimetype='image/vnd.microsoft.icon')


@basic.route("/site-map", methods=['GET', 'POST'])
def site_map():
    output = []
    for rule in current_app.url_map.iter_rules():
        options = {}
        for arg in rule.arguments:
            options[arg] = "[{0}]".format(arg)

        methods = ','.join(rule.methods)
        try:
            url = url_for(rule.endpoint, **options)
        except Exception as e:
            url = f"Unknown error: {e}"
        line = unquote("<td>{:50s}</td><td>{:20s}</td><td>{}</td>".format(rule.endpoint, methods, url))
        output.append(line)
    return "<table><tr>{}</tr></table>".format("</tr><tr>".join(sorted(output)))
