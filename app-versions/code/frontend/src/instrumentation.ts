import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'translation-frontend';

const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({
        url: `${base}/v1/traces`,
    }),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
            url: `${base}/v1/metrics`,
        }),
        exportIntervalMillis: 10000,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
