#!/usr/bin/env python3
"""
Generate synthetic traces for two services (api-service, payment-service)
and send them to Tempo via both HTTP and gRPC.

Generates ~1 trace every 2-5 seconds with realistic attributes, errors, and latencies.
"""

import random
import time
import logging
from datetime import datetime
from typing import Optional

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HTTPExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration (check env vars first, fall back to localhost)
import os
TEMPO_GRPC_ENDPOINT = os.getenv("TEMPO_GRPC_ENDPOINT", "http://localhost:4317")
TEMPO_HTTP_ENDPOINT = os.getenv("TEMPO_HTTP_ENDPOINT", "http://localhost:4318")
TRACE_INTERVAL_MIN = 2  # seconds
TRACE_INTERVAL_MAX = 5  # seconds
ERROR_RATE = 0.3  # 30% error rate

# HTTP Methods for realistic spans
HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"]
HTTP_PATHS = [
    "/api/users",
    "/api/orders",
    "/api/payments",
    "/api/auth/login",
    "/api/products",
    "/api/checkout",
]

# Payment service endpoints
PAYMENT_ENDPOINTS = [
    "/process",
    "/validate",
    "/refund",
]

# Error messages for failure scenarios
ERROR_MESSAGES = [
    "Payment declined",
    "Insufficient funds",
    "Service timeout",
    "Invalid card",
    "Rate limit exceeded",
]


def create_tracer_provider():
    """Create and configure TracerProvider with HTTP exporter to Tempo."""
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: "trace-generator",
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
    })

    provider = TracerProvider(resource=resource)

    # Add HTTP exporter to Tempo
    http_exporter = HTTPExporter(endpoint=TEMPO_HTTP_ENDPOINT)
    provider.add_span_processor(BatchSpanProcessor(http_exporter))

    trace.set_tracer_provider(provider)
    return provider


def generate_api_service_trace(tracer):
    """Generate a trace for api-service calling payment-service."""
    method = random.choice(HTTP_METHODS)
    path = random.choice(HTTP_PATHS)
    api_latency = random.uniform(50, 200)  # 50-200ms

    with tracer.start_as_current_span("api-request") as api_span:
        api_span.set_attribute("service.name", "api-service")
        api_span.set_attribute("http.method", method)
        api_span.set_attribute("http.url", f"http://api-service:3000{path}")
        api_span.set_attribute("http.client_ip", f"192.168.1.{random.randint(1, 254)}")
        api_span.set_attribute("user.id", f"user-{random.randint(100, 999)}")

        # Simulate API processing
        time.sleep(api_latency / 1000)

        # Call to payment service (as child span)
        call_payment_service(tracer)

        # Set response status
        success = random.random() > ERROR_RATE
        status_code = random.choice([200, 201]) if success else random.choice([400, 401, 403, 500, 503])
        api_span.set_attribute("http.status_code", status_code)
        api_span.set_attribute("http.response_time_ms", api_latency)

        if not success:
            api_span.set_attribute("error.type", "HTTP_ERROR")
            api_span.set_attribute("error.message", f"HTTP {status_code}")

        logger.info(f"✓ api-service: {method} {path} → {status_code} ({api_latency:.1f}ms)")


def call_payment_service(tracer):
    """Generate a span for payment-service processing."""
    endpoint = random.choice(PAYMENT_ENDPOINTS)
    payment_latency = random.uniform(100, 500)  # 100-500ms

    with tracer.start_as_current_span("payment-request") as payment_span:
        payment_span.set_attribute("service.name", "payment-service")
        payment_span.set_attribute("http.method", "POST")
        payment_span.set_attribute("http.url", f"http://payment-service:3001/payment{endpoint}")
        payment_span.set_attribute("payment.method", random.choice(["credit_card", "debit_card", "paypal"]))
        payment_span.set_attribute("payment.amount", f"{random.randint(10, 1000)}.00")
        payment_span.set_attribute("payment.currency", "USD")
        payment_span.set_attribute("merchant.id", f"merchant-{random.randint(100, 999)}")

        # Simulate payment processing
        time.sleep(payment_latency / 1000)

        success = random.random() > ERROR_RATE
        status_code = 200 if success else random.choice([400, 402, 503])

        payment_span.set_attribute("http.status_code", status_code)
        payment_span.set_attribute("payment.processing_time_ms", payment_latency)

        if not success:
            error_msg = random.choice(ERROR_MESSAGES)
            payment_span.set_attribute("error.type", "PAYMENT_ERROR")
            payment_span.set_attribute("error.message", error_msg)
            logger.info(f"  ✗ payment-service: POST {endpoint} → {status_code} ({error_msg})")
        else:
            logger.info(f"  ✓ payment-service: POST {endpoint} → {status_code} ({payment_latency:.1f}ms)")


def main():
    """Main loop: generate traces continuously on schedule."""
    logger.info("Initializing OpenTelemetry SDK...")
    provider = create_tracer_provider()
    tracer = trace.get_tracer(__name__)

    logger.info(f"Starting trace generation (gRPC: {TEMPO_GRPC_ENDPOINT}, HTTP: {TEMPO_HTTP_ENDPOINT})")
    logger.info(f"Error rate: {ERROR_RATE*100:.0f}% | Interval: {TRACE_INTERVAL_MIN}-{TRACE_INTERVAL_MAX}s")
    logger.info("Press Ctrl+C to stop.\n")

    trace_count = 0

    try:
        while True:
            try:
                trace_count += 1
                timestamp = datetime.now().strftime("%H:%M:%S")
                logger.info(f"[{timestamp}] Generating trace #{trace_count}...")

                generate_api_service_trace(tracer)

                # Random interval between traces
                interval = random.uniform(TRACE_INTERVAL_MIN, TRACE_INTERVAL_MAX)
                time.sleep(interval)

            except Exception as e:
                logger.error(f"Error generating trace: {e}", exc_info=True)
                time.sleep(1)

    except KeyboardInterrupt:
        logger.info(f"\nShutdown: Generated {trace_count} traces. Flushing...")
        provider.force_flush()
        logger.info("Traces flushed. Goodbye!")


if __name__ == "__main__":
    main()
