# ⚠️ Run Trace Generator Locally

The `generate-traces.py` script **must be run on your host machine**, not in a Docker container.

## Why

- Docker containers in this environment cannot access external package repositories due to corporate firewall + SSL certificate verification
- The host machine's pip is configured with Artifactory credentials and works correctly
- Running locally avoids complex Docker networking and credential passing issues

## How to Run

```bash
# Activate your venv (required)
source venv/bin/activate

# Run in foreground (see output)
python3 compose_david/test_scripts/generate-traces.py

# Or run in background
nohup python3 compose_david/test_scripts/generate-traces.py > traces.log 2>&1 &

# Check background logs
tail -f traces.log
```

## Prerequisites

- `docker compose up -d` running (Prometheus, Loki, Tempo)
- Python venv with dependencies installed: `pip install -r compose_david/test_scripts/requirements.txt`
- Host machine configured to access Artifactory (via `~/.pip/pip.conf`)

## What It Does

Generates synthetic traces continuously:
- Two services: `api-service` → `payment-service`
- ~1 trace every 2-5 seconds
- 30% error rate
- Variable latencies (50-500ms)
- Ships traces to Tempo on `localhost:4318`

Traces flow into Tempo and appear in metrics/queries within seconds.
