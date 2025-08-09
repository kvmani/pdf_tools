#!/bin/bash

# Optional config path can be supplied as first argument
CONFIG_PATH=${1:-$PDF_TOOLS_CONFIG}
export PDF_TOOLS_CONFIG="$CONFIG_PATH"

export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-8000}

source venv/bin/activate
exec python -m pdf_tools_service
