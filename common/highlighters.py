import json
from pygments import highlight
from pygments.lexers import PythonLexer, JavaLexer, JavascriptLexer, TypeScriptLexer
from pygments.formatters import HtmlFormatter
from html.parser import HTMLParser


def highlight_python_code(code, linenos=True, prestyles=''):
    formatter = HtmlFormatter(linenos=linenos, noclasses=True,
                              lineanchors="code-lineno",
                              linespans="code-span",
                              prestyles=prestyles,
                              # style='colorful'
                              )
    return highlight(code, PythonLexer(), formatter)


def highlight_java_code(code, linenos=True, prestyles=''):
    formatter = HtmlFormatter(linenos=linenos, noclasses=True,
                              lineanchors="code-lineno",
                              linespans="code-span",
                              prestyles=prestyles,
                              # style='colorful'
                              )
    return highlight(code, JavaLexer(), formatter)


def highlight_javascript_code(code, linenos=True, prestyles=''):
    formatter = HtmlFormatter(linenos=linenos, noclasses=True,
                              lineanchors="code-lineno",
                              linespans="code-span",
                              prestyles=prestyles,
                              # style='colorful'
                              )
    return highlight(code, JavascriptLexer(), formatter)


def highlight_typescript_code(code, linenos=True, prestyles=''):
    formatter = HtmlFormatter(linenos=linenos, noclasses=True,
                              lineanchors="code-lineno",
                              linespans="code-span",
                              prestyles=prestyles,
                              # style='colorful'
                              )
    return highlight(code, TypeScriptLexer(), formatter)

def highlight_json(value, linenos=False, prestyles=''):
    code = json.dumps(value)
    formatter = HtmlFormatter(linenos=linenos, noclasses=True,
                              lineanchors="code-lineno",
                              linespans="code-span",
                              prestyles='margin-bottom: 0px',
                              # style='colorful'
                              )
    return highlight(code, JavascriptLexer(), formatter)


class MLStripper(HTMLParser):
    def __init__(self):
        # HTMLParser's constructor sets convert_charrefs; without it feed() raises AttributeError
        super().__init__(convert_charrefs=True)
        self.fed = []

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return ''.join(self.fed)


def strip_tags(html):
    s = MLStripper()
    s.feed(html)
    return s.get_data()
