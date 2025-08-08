# Deployment on Intranet

These instructions assume an offline intranet environment.

1. Install dependencies from a local package mirror.
2. Set up a Python virtual environment.
3. Use `gunicorn` with systemd to run the app on `0.0.0.0:8000`.
4. Configure your intranet DNS to route traffic to the server.
5. Optionally configure Prometheus to scrape `/pdf_tools/metrics` for basic
   request statistics.

Use `setup.sh /path/to/config.json` to create the environment and
`gunicorn.sh /path/to/config.json` for production serving. For ad-hoc testing
the `run.sh` script can also be used.
