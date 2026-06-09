FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./backend/app
COPY worker ./worker

ENV PYTHONPATH=/app/backend:/app

CMD ["python", "-m", "worker.main"]
