#!/bin/bash
echo "=== STARTING APP ==="
echo "PORT=$PORT"
echo "SUPABASE_URL=${SUPABASE_URL:0:30}..."

# Import test
python -c "from app.main import app; print('Import OK')" 2>&1
if [ $? -ne 0 ]; then
    echo "IMPORT FAILED"
    python -c "import app.core.config; print('config OK')" 2>&1
    python -c "import app.core.database; print('database OK')" 2>&1
    exit 1
fi

echo "Starting uvicorn on port $PORT"
uvicorn app.main:app --host 0.0.0.0 --port $PORT --log-level debug
