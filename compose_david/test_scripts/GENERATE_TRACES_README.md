# Generate Synthetic Traces for Tempo

This script generates realistic distributed traces for two services (`api-service` and `payment-service`) and sends them to Tempo via both gRPC and HTTP protocols.

## Features

- **Two services**: api-service (frontend) → payment-service (backend)
- **Realistic spans**: HTTP methods, paths, status codes, latencies
- **Error scenarios**: ~30% error rate with realistic error messages
- **Varying latencies**: 50-500ms per operation
- **Continuous generation**: ~1 trace every 2-5 seconds
- **Dual protocol**: Sends via both gRPC (4317) and HTTP (4318) to Tempo
- **Rich attributes**: Service names, HTTP details, payment info, user IDs, etc.

## Setup

### 1. Install dependencies

```bash
cd compose_david/test_scripts
pip install -r requirements.txt
```

### 2. Ensure Tempo is running

```bash
# From compose_david directory
docker compose up tempo
```

Verify Tempo is ready:
```bash
curl http://localhost:3200/ready
```

## Usage

### Start trace generation

```bash
python3 generate-traces.py
```

Output:
```
2026-09-20 12:45:23 - INFO - Initializing OpenTelemetry SDK...
2026-09-20 12:45:23 - INFO - Starting trace generation (gRPC: http://localhost:4317, HTTP: http://localhost:4318)
2026-09-20 12:45:23 - INFO - Error rate: 30% | Interval: 2-5s
2026-09-20 12:45:23 - INFO - Press Ctrl+C to stop.

[12:45:23] Generating trace #1...
✓ api-service: POST /api/orders → 200 (127.3ms)
  ✓ payment-service: POST /process → 200 (245.1ms)
[12:45:26] Generating trace #2...
✓ api-service: GET /api/users → 403 (89.2ms)
  ✗ payment-service: POST /validate → 400 (Payment declined)
```

### Stop generation

Press `Ctrl+C` to stop and flush remaining traces to Tempo.

## Configuration

Edit `generate-traces.py` to customize:

```python
TRACE_INTERVAL_MIN = 2      # Minimum seconds between traces
TRACE_INTERVAL_MAX = 5      # Maximum seconds between traces
ERROR_RATE = 0.3            # Fraction of failed requests (0.0-1.0)
TEMPO_GRPC_ENDPOINT = "http://localhost:4317"
TEMPO_HTTP_ENDPOINT = "http://localhost:4318"
```

## Trace Structure

Each trace includes:

### API Service Span
- `http.method` (GET, POST, PUT, DELETE, PATCH)
- `http.url` (realistic API paths)
- `http.status_code` (200, 201, 400, 401, 403, 500, 503)
- `http.client_ip` (random client IP)
- `user.id` (user-XXX)
- `http.response_time_ms` (latency)

### Payment Service Span (child of API)
- `http.method` (always POST)
- `http.url` (/process, /validate, /refund)
- `http.status_code`
- `payment.method` (credit_card, debit_card, paypal)
- `payment.amount` (amount in USD)
- `payment.currency`
- `merchant.id` (merchant-XXX)
- `payment.processing_time_ms` (latency)
- `error.type` & `error.message` (on failures)

## Viewing Traces in Tempo

Once traces are generated, query them via:

```bash
# Tempo UI (if Grafana is integrated)
curl http://localhost:3200/api/traces

# Search for api-service traces
curl 'http://localhost:3200/api/search?service=api-service'

# Search for payment-service errors
curl 'http://localhost:3200/api/search?service=payment-service&tags=error'
```

## Querying Generated Metrics

The Tempo Metrics Generator automatically extracts RED metrics from traces:

```bash
# Query throughput (requests/sec)
curl 'http://localhost:9090/api/v1/query?query=rate(traces_spanmetrics_calls_total%5B1m%5D)'

# Query error rate
curl 'http://localhost:9090/api/v1/query?query=rate(traces_spanmetrics_errors_total%5B1m%5D)'

# Query latency (p95)
curl 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,traces_spanmetrics_duration_bucket)'
```

## Notes

- Both gRPC and HTTP exporters are active simultaneously (redundancy)
- Batch processing: traces are sent in batches to Tempo (more efficient)
- Service names auto-populate in Prometheus from trace attributes
- Errors are intentionally distributed across different status codes/messages for realism
