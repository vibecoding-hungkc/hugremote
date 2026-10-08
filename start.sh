#!/usr/bin/env bash
set -e

PORT=${PORT:-8099}
HOST=${HOST:-::}
BASE_PATH=${BASE_PATH:-}
WORKSPACE_ROOT=${WORKSPACE_ROOT:-/home/hermes-admin/projects}
ALLOWED_ROOT=${ALLOWED_ROOT:-/home/hermes-admin}

cd /home/hermes-admin/projects/hugcode/server
echo "Starting HugCode on host port $PORT (BASE_PATH='${BASE_PATH}')..."
PORT=$PORT HOST=$HOST BASE_PATH=$BASE_PATH WORKSPACE_ROOT=$WORKSPACE_ROOT ALLOWED_ROOT=$ALLOWED_ROOT node dist/index.js
