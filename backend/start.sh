#!/bin/bash
set -e

# Print env vars (excluding secrets) for debugging
echo "=== Environment ==="
echo "PORT: $PORT"
echo "SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "CORS_ORIGINS: $CORS_ORIGINS"
echo "=================="

# Try to import the app first
echo "Testing imports..."
python -c "from app.main import app; print('Import OK')" 2>&1 || {
    echo "Import failed!"
    python -c "import app.core.config; print('config OK')" 2>&1
    python -c "import app.core.database; print('database OK')" 2>&1
    exit 1
}

echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --log-level debug
