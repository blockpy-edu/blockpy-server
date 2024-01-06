"""
Any of the basic app pages, like the site-map and the about page.
"""
import os
from urllib.parse import unquote

from flask import render_template, current_app, send_from_directory, url_for


@current_app.route('/', methods=['GET', 'POST'])
def index():
    """
    The main index page.

    :return: index page for the entire app
    """
    return render_template('index.html')


@current_app.route('/about/', methods=['GET', 'POST'])
@current_app.route('/about', methods=['GET', 'POST'])
@current_app.route('/public/', methods=['GET', 'POST'])
@current_app.route('/public', methods=['GET', 'POST'])
@current_app.route('/contact/', methods=['GET', 'POST'])
@current_app.route('/contact', methods=['GET', 'POST'])
def about():
    """
    Information about the various projects.
    """
    return render_template('about.html')


@current_app.route('/favicon.ico', methods=['GET', 'POST'])
def favicon():
    return send_from_directory(os.path.join(current_app.root_path, 'static'),
                               'favicon.ico',
                               mimetype='image/vnd.microsoft.icon')


@current_app.route("/site-map", methods=['GET', 'POST'])
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
