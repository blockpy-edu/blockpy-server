"""
The ASGI portal for BlockPy Server (Quart)
"""

from main import create_app

# Quart uses ASGI, so we create the app normally
app = create_app()

# For compatibility, also expose as 'application'
application = app

if __name__ == '__main__':
    app.run()
