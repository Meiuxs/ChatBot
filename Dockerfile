FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD python -u -c "
import os, sys, time
print('=== Container Starting ===')
print(f'PORT={os.environ.get(\"PORT\")}')
print(f'CWD={os.getcwd()}')
print(f'Files: {os.listdir(\".\")}')
print(f'App dir: {os.listdir(\"app\") if os.path.isdir(\"app\") else \"NOT FOUND\"}')
sys.stdout.flush()

# Test import
try:
    from app.main import app
    print('Import OK')
    sys.stdout.flush()
except Exception as e:
    print(f'Import Error: {e}')
    sys.stdout.flush()
    sys.exit(1)

import uvicorn
port = int(os.environ.get('PORT', 8000))
print(f'Starting uvicorn on port {port}')
sys.stdout.flush()
uvicorn.run(app, host='0.0.0.0', port=port, log_level='debug')
"
