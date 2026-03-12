#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -x ".venv/bin/python" ]]; then
  PYTHONDONTWRITEBYTECODE=1 exec .venv/bin/python main.py
fi

PYTHONDONTWRITEBYTECODE=1 exec python3 main.py
