# Deployment on Intranet

These instructions assume an offline intranet environment.

1. Install dependencies from a local package mirror.
2. Set up a Python virtual environment.
3. Use `gunicorn` with systemd to run the app on `0.0.0.0:8000`.
4. Configure your intranet DNS to route traffic to the server.

See `setup.sh` for required packages and `run.sh` for the launch command.
