import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const sdk = new NodeSDK({
    serviceName: 'translation-frontend',
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
            url: 'http://otel-collector:4318/v1/metrics',
        }),
        exportIntervalMillis: 10000,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
