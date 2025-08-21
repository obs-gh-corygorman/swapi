const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } = require('@opentelemetry/semantic-conventions');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

// Global SDK instance for graceful shutdown
let sdk;

// Initialize OpenTelemetry
function initializeOpenTelemetry() {
  // Create resource with service information
  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: 'swapi-server',
    [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? 
      `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` : 
      'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN ? {
      'Authorization': `Bearer ${process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN}`
    } : {},
  });

  // Configure metric reader
  let metricReader;

  // OTLP Metric Exporter
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    metricReader = new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
        headers: process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN ? {
          'Authorization': `Bearer ${process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN}`
        } : {},
      }),
      exportIntervalMillis: 30000, // Export every 30 seconds
    });
  }

  // Initialize the SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable some instrumentations that might be noisy
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          requestHook: (span, request) => {
            span.setAttributes({
              'http.request.header.user-agent': request.getHeader('user-agent'),
              'http.request.header.referer': request.getHeader('referer'),
            });
          },
        },
        // Configure Express instrumentation
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        // Configure Mongoose instrumentation
        '@opentelemetry/instrumentation-mongoose': {
          enabled: true,
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();

  console.log('OpenTelemetry initialized successfully');

  return sdk;
}

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry terminated'))
    .catch((error) => console.log('Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0));
});

module.exports = { initializeOpenTelemetry };
