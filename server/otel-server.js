const { Meter, metrics, trace, Tracer } = require("@opentelemetry/api");
const { logs, Logger, SeverityNumber } = require("@opentelemetry/api-logs");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-http");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-http");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { resourceFromAttributes } = require("@opentelemetry/resources");
const {
  BatchLogRecordProcessor,
  LoggerProvider,
} = require("@opentelemetry/sdk-logs");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { ATTR_SERVICE_NAME } = require("@opentelemetry/semantic-conventions");

// Configuration
const serviceName = "swapi-server";

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
const otlpEndpointBearerToken = process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN;

const authHeader = otlpEndpointBearerToken
  ? { Authorization: `Bearer ${otlpEndpointBearerToken}` }
  : {};

// Create resource
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
});

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    headers: {
      ...authHeader,
      "x-observe-target-package": "Tracing",
    },
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
      headers: {
        ...authHeader,
        "x-observe-target-package": "Metrics",
      },
    }),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

// Initialize Logger Provider
const loggerProvider = new LoggerProvider({
  resource: resource,
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${otlpEndpoint}/v1/logs`,
        headers: {
          ...authHeader,
          "x-observe-target-package": "Logs",
        },
      })
    ),
  ],
});

// Initialize OpenTelemetry and return initialized components
function initOtel() {
  try {
    sdk.start();

    // Initialize tracer, logger, and meter after SDK is started
    const tracer = trace.getTracer(serviceName);
    const logger = loggerProvider.getLogger(serviceName);
    const meter = metrics.getMeter(serviceName);

    logs.setGlobalLoggerProvider(loggerProvider);

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "OpenTelemetry SDK started for SWAPI server",
      attributes: { service: serviceName },
    });

    return { tracer, logger, meter };
  } catch (error) {
    const logger = loggerProvider.getLogger(serviceName);
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: "Error starting OpenTelemetry SDK",
      attributes: { error: error.message, service: serviceName },
    });
    throw error;
  }
}

// Graceful shutdown
function shutdownOtel() {
  try {
    sdk.shutdown();
  } catch (error) {
    const logger = loggerProvider.getLogger(serviceName);
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: "Error shutting down OpenTelemetry SDK",
      attributes: { error: error.message, service: serviceName },
    });
    throw error;
  }
}

module.exports = { initOtel, shutdownOtel };
