# BlockPy Server - GitHub Copilot Development Instructions

BlockPy Server is a Flask-based LTI (Learning Tools Interoperability) application for educational programming environments. It consists of a Python Flask backend with PostgreSQL database, TypeScript frontend, Redis for background tasks, and nginx for production deployment.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap Development Environment
**CRITICAL**: Network connectivity to PyPI can be unreliable. Use generous timeouts and be prepared for network-related failures.

```bash
# Create Python virtual environment
python3 -m venv venv  # Takes ~3 seconds

# Upgrade pip (essential for better network handling)
venv/bin/pip install --upgrade pip --timeout 300  # Takes ~3 seconds, NEVER CANCEL: Set timeout to 5+ minutes

# Install Python dependencies (NETWORK INTENSIVE)
venv/bin/pip install -r requirements.txt --timeout 600  # Takes 3-5 minutes, NEVER CANCEL: Set timeout to 10+ minutes
# Alternative if network fails: venv/bin/pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt

# Install frontend dependencies
cd frontend
npm install --ignore-scripts  # Takes ~15 seconds first time, <1 second when cached
npm install -D rimraf npm-run-all cross-env shx lite-server  # Install missing dev dependencies
```

### Build the Application
```bash
# Create required directories
make create_directories  # Takes <1 second

# Build frontend (TypeScript compilation and webpack bundling)
cd frontend
npm run build  # Takes 30-60 seconds, NEVER CANCEL: Set timeout to 5+ minutes
# Note: May fail with TypeScript errors due to dependency conflicts - this is a known issue

# Alternative frontend build without TypeScript checks
npm run build:dist:dev  # Skips TypeScript compilation, faster build
```

### Database Setup
```bash
# Setup PostgreSQL database (requires running PostgreSQL instance)
venv/bin/python manage.py create_db  # Creates database tables
venv/bin/python manage.py db upgrade  # Runs any pending migrations
venv/bin/python manage.py populate_db  # Adds default data
venv/bin/python manage.py add_test_users_db  # Adds test users (optional)
```

### Running the Application

#### Development Server (Local)
```bash
# Start Flask development server
venv/bin/python main.py  # Requires database connection
# Server runs on http://localhost:5000 by default
```

#### Docker Deployment (Recommended)
```bash
# Setup environment files
cp conf/.env.dev.example .env
cp conf/.env.dev.db.example .env.db
# Edit .env and .env.db with your settings

# Create configuration file
cp instance/configuration.py.template instance/configuration.py
# Edit instance/configuration.py with your settings

# Build and start full stack - NEVER CANCEL: Takes 10-20 minutes
docker compose build --timeout 1800  # NEVER CANCEL: Set timeout to 30+ minutes
docker compose up -d  # Starts PostgreSQL, Redis, nginx, and Flask app
```

### Testing
```bash
# Run basic tests
venv/bin/python -m pytest tests/  # Takes 10-30 seconds, NEVER CANCEL: Set timeout to 2+ minutes
# Alternative: python tests.py

# Run specific test
venv/bin/python tests/test_code_parts.py
```

## Validation

### Manual Testing Steps
After making changes, ALWAYS perform these validation steps:

1. **Application Startup**: Verify the Flask app starts without errors
2. **Database Connection**: Confirm database migrations run successfully  
3. **Frontend Build**: Ensure TypeScript/webpack build completes
4. **Basic Functionality**: Test at least one complete user workflow:
   - Navigate to the application URL
   - Attempt to log in or access a basic page
   - Verify static assets load correctly
5. **API Endpoints**: Test basic API endpoints respond correctly

### Docker Validation
```bash
# Check all services are running
docker compose ps  # All services should show "Up"

# Check application logs
docker compose logs web  # Flask application logs
docker compose logs db   # PostgreSQL logs
docker compose logs redis # Redis logs

# Test application accessibility
curl -I http://localhost  # Should return HTTP 200 or redirect
```

## Common Tasks

### Network Troubleshooting
If pip install fails with network errors:
```bash
# Use trusted hosts and increased timeout
pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org --timeout 600 -r requirements.txt

# Alternative: Use Docker which may have better network handling
docker compose build --no-cache
```

### Frontend Development
```bash
# Watch mode for development (auto-rebuild on changes)
cd frontend
npm run watch  # Continuous build, press Ctrl+C to stop

# Clean build
npm run clean  # Removes built files
npm run build  # Full rebuild
```

### Database Management
```bash
# Reset database (destructive)
venv/bin/python manage.py reset_db  # CAUTION: Deletes all data
venv/bin/python manage.py populate_db  # Repopulate with defaults

# Create migration for schema changes
venv/bin/python manage.py db migrate -m "Description of changes"
venv/bin/python manage.py db upgrade
```

## Project Structure

### Repository Root
```
├── frontend/           # TypeScript frontend source
├── static/            # Static assets (CSS, JS, images)
├── templates/         # Jinja2 HTML templates
├── models/           # SQLAlchemy database models
├── controllers/      # Flask route controllers
├── instance/         # Instance-specific configuration
├── requirements.txt  # Python dependencies (~62 packages)
├── docker-compose.yml # Full stack deployment
├── Dockerfile        # Container build definition
└── manage.py         # CLI management commands
```

### Key Files
- `main.py` - Flask application factory
- `config.py` - Default configuration settings
- `instance/configuration.py` - Override configuration (create from template)
- `frontend/package.json` - Node.js dependencies and build scripts
- `makefile` - Utility commands for directory setup

## Important Notes

### CRITICAL Timeouts and Timing
- **Python package installation**: NEVER CANCEL builds. Takes 3-5 minutes normally, up to 10 minutes with network issues. Set timeout to 10+ minutes.
- **Docker build**: NEVER CANCEL. Full build takes 10-20 minutes. Set timeout to 30+ minutes.
- **Frontend build**: Takes 30-60 seconds normally, up to 5 minutes with issues. Set timeout to 5+ minutes.
- **Database operations**: Usually fast (<30 seconds), but set timeout to 2+ minutes for safety.

### Network Dependencies
- Requires internet access for PyPI (Python packages) and npm registry
- Docker may handle network issues better than direct pip install
- If network fails persistently, document the specific error and continue with available tools

### Configuration Requirements
- PostgreSQL database connection required for full functionality
- Redis required for background tasks (Huey)
- SSL certificates needed for production LTI integration
- LTI consumer key/secret required for Canvas integration

### Development vs Production
- Development: Can use SQLite database, simplified config
- Production: Requires PostgreSQL, Redis, nginx, proper SSL certificates
- Docker deployment recommended for production-like environment

## Troubleshooting Common Issues

### "ModuleNotFoundError: No module named 'flask'"
- Ensure virtual environment is activated: `source venv/bin/activate`
- Verify requirements.txt installation completed successfully

### TypeScript build errors
- Known issue with dependency type conflicts
- Try `npm run build:dist:dev` for webpack-only build
- Or continue with Python backend development

### Database connection errors
- Ensure PostgreSQL is running (via Docker or system service)
- Verify database credentials in `instance/configuration.py`
- Check if database and user exist in PostgreSQL

### Docker services not starting
- Check logs: `docker compose logs [service_name]`
- Ensure ports 80, 443, 5432, 6379 are not in use
- Verify `.env` and `.env.db` files are properly configured

Always run through at least one complete development workflow after making changes to ensure the application remains functional.