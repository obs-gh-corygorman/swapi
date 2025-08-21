const { metrics, trace } = require("@opentelemetry/api");
const { logs, SeverityNumber } = require("@opentelemetry/api-logs");
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
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require("@opentelemetry/semantic-conventions");

// Configuration
const serviceName = "swapi-server";
const serviceVersion = "1.0.0";

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317";
const otlpEndpointBearerToken = process.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN;

const authHeader = otlpEndpointBearerToken
  ? { Authorization: `Bearer ${otlpEndpointBearerToken}` }
  : {};

// Create resource
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
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
  instrumentations: [getNodeAutoInstrumentations({
    // Configure auto-instrumentations
    '@opentelemetry/instrumentation-express': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-http': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-mongoose': {
      enabled: true,
    },
  })],
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
          "x-observe-target-package": "Host Explorer",
        },
      })
    ),
  ],
});

let tracer, logger, meter;

// Initialize OpenTelemetry and return initialized components
function initOtel() {
  try {
    sdk.start();

    // Initialize tracer, logger, and meter after SDK is started
    tracer = trace.getTracer(serviceName, serviceVersion);
    logger = loggerProvider.getLogger(serviceName, serviceVersion);
    meter = metrics.getMeter(serviceName, serviceVersion);

    logs.setGlobalLoggerProvider(loggerProvider);

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "OpenTelemetry SDK started successfully",
      attributes: {
        service: serviceName,
        version: serviceVersion,
      },
    });

    console.log("OpenTelemetry initialized successfully");
    return { tracer, logger, meter };
  } catch (error) {
    console.error("Error starting OpenTelemetry SDK:", error);
    const fallbackLogger = loggerProvider.getLogger(serviceName, serviceVersion);
    fallbackLogger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: "Error starting OpenTelemetry SDK",
      attributes: { error: error.message },
    });
    throw error;
  }
}

// Graceful shutdown
function shutdownOtel() {
  try {
    sdk.shutdown();
    console.log("OpenTelemetry SDK shutdown successfully");
  } catch (error) {
    console.error("Error shutting down OpenTelemetry SDK:", error);
    if (logger) {
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: "ERROR",
        body: "Error shutting down OpenTelemetry SDK",
        attributes: { error: error.message },
      });
    }
    throw error;
  }
}

module.exports = {
  initOtel,
  shutdownOtel,
  get tracer() { return tracer; },
  get logger() { return logger; },
  get meter() { return meter; },
};
