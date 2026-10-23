FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 EDGEWATCH_DB=/data/edgewatch.sqlite3 EDGEWATCH_HOST=0.0.0.0
WORKDIR /app
COPY pyproject.toml README.md ./
COPY edgewatch ./edgewatch
RUN pip install --no-cache-dir '.[mqtt]' && groupadd -r edgewatch && useradd -r -g edgewatch edgewatch && mkdir /data && chown edgewatch:edgewatch /data
USER edgewatch
EXPOSE 8765
CMD ["python", "-m", "edgewatch", "--mode", "demo"]
