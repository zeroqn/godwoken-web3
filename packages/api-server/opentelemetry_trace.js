'use strict'

const opentelemetry = require('@opentelemetry/sdk-node');
const { BatchSpanProcessor } = require('@opentelemetry/tracing')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
// const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger')
const { JaegerPropagator } = require('@opentelemetry/propagator-jaeger')
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');

const provider = new NodeTracerProvider()
provider.addSpanProcessor(new BatchSpanProcessor(exporter))
provider.register({ propagator: new JaegerPropagator() })

// Use jaeger exporter, until rust opentelemetry-otlp remove protoc requirement for build
const traceExporter = new JaegerExporter(options)
// const traceExporter = new OTLPTraceExporter();

const sdk = new opentelemetry.NodeSDK({
    traceExporter,
    instrumentations: [
        new ExpressInstrumentation(),
        new HttpInstrumentation(),
        // Add trace_id, span_id and trace_flags to log
        new WinstonInstrumentation({
            // Also add 'service.name' from OTEL_RESOURCE_ATTRIBUTES env
            // Example: OTEL_RESOURCE_ATTRIBUTES: service.name=web3-readonly1
            logHook: (_span, _record) => {
                record['resource.service.name'] = provider.resource.attributes['service.name']
            }
        }),
        getNodeAutoInstrumentations()
    ]
});

sdk.start()
    .then(() => console.log('Opentelemetry tracing initialized'))
    .catch((error) => console.log('Error initializing opentelemetry tracing', error));

const process = require('process');
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('Opentelemetry Tracing terminated'))
        .catch((error) => console.log('Error terminating opentelemetry tracing', error))
        .finally(() => process.exit(0));
});
