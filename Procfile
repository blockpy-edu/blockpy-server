release: python manage.py db upgrade
web: hypercorn asgi:application --bind 0.0.0.0:8888 --log-file -
