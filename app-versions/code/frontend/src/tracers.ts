import { trace } from '@opentelemetry/api';


export const tracer = trace.getTracer('translation-frontend', '1.0.0');