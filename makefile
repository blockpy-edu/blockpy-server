help:
	sed '/^\t/ d' makefile
update_blockpy:
	python manage.py update_blockpy
update_datasets_dev:
	python manage.py update_datasets
update_datasets:
	py3 manage.py update_datasets
check_log:
	less +G /var/log/uwsgi/kennel.log
check_interactions:
	less +G log/student_interactions/student_interactions.log
restart_server:
	sudo systemctl restart uwsgi
redo_database:
	python.exe manage.py reset_db
	python.exe manage.py populate_db
	python.exe manage.py add_test_users_db
	python.exe manage.py add_maze_course_db
create_directories:
	mkdir -p static/uploads/
	mkdir -p static/gen/
	mkdir -p static/.webassets-cache/
	mkdir -p static/uploads/submission_blocks/
	mkdir -p static/public/
	mkdir -p certs/
	mkdir -p logs/
	mkdir -p backups/
	mkdir -p instance/
	mkdir -p instance/certs/

restart_redis:
	sudo systemctl restart redis-server.service
check_redis:
	sudo systemctl status redis-server
check_huey:
	sudo journalctl -u huey

test:
	pytest