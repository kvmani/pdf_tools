#!/bin/bash
# Optional config path as first argument for later use
CONFIG_PATH=${1:-$PDF_TOOLS_CONFIG}
export PDF_TOOLS_CONFIG="$CONFIG_PATH"

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -e ..
