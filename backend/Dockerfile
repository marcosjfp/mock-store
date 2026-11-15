FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Migrate, load the demo workspace (a no-op once it has data), then serve.
CMD ["sh", "-c", "alembic upgrade head && python scripts/seed_demo.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
