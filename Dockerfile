FROM python:3.12-slim

WORKDIR /app

# Copy everything from backend first, then install from copied requirements
COPY backend/ .

RUN pip install --no-cache-dir -r requirements.txt

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
