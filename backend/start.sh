#!/bin/bash

# Railway should provide PORT environment variable
if [ -z "$PORT" ]; then
    echo "ERROR: PORT environment variable is not set"
    echo "Railway should provide this automatically"
    exit 1
fi

echo "Starting FastAPI application on port $PORT"

# Start the application
poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT
