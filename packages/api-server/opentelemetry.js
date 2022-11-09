'use strict'

const process = require('process');
const opentelemetry = require('@opentelemetry/sdk-node');

const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');

const provider = new NodeTracerProvider()

// Configuration through env:
// OTEL_TRACES_EXPORTER
// OTEL_EXPORTER_OTLP_PROTOCOL
// OTEL_EXPORTER_OTLP_TRACES_PROTOCOL
// OTEL_EXPORTER_OTLP_METRICS_PROTOCOL
//
// For jaeger example:
// OTEL_TRACES_EXPORTER: jaeger
// OTEL_EXPORTER_OTLP_PROTOCOL: grpc (default is http/protobuf)
// OTEL_EXPORTER_JAEGER_ENDPOINT: http://jaeger:14250
//
// Reference: https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/README.md
const sdk = new opentelemetry.NodeSDK({
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-redis': {},
            '@opentelemetry/instrumentation-http': {},
            '@opentelemetry/instrumentation-express': {},
            '@opentelemetry/instrumentation-winston': {
                // Add trace_id, span_id and trace_flags to log entry
                // Also add 'service.name' from OTEL_RESOURCE_ATTRIBUTES env
                //
                // Example: OTEL_RESOURCE_ATTRIBUTES: service.name=web3-readonly1
                logHook: (_span, _record) => {
                    record['resource.service.name'] = provider.resource.attributes['service.name']
                }
            }
        })
    ]
});

sdk.start()
    .then(() => console.log('Opentelemetry tracing initialized'))
    .catch((error) => console.log('Error initializing opentelemetry tracing', error));

process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('Opentelemetry Tracing terminated'))
        .catch((error) => console.log('Error terminating opentelemetry tracing', error))
        .finally(() => process.exit(0));
});
