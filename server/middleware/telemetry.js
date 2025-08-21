const { trace, context, SpanStatusCode } = require("@opentelemetry/api");
const { SeverityNumber } = require("@opentelemetry/api-logs");
const { tracer, logger, meter } = require("../otel");

// Initialize metrics
const requestCounter = meter.createCounter("http_requests_total", {
  description: "Total number of HTTP requests",
});

const requestDuration = meter.createHistogram("http_request_duration_ms", {
  description: "Duration of HTTP requests in milliseconds",
});

const activeRequests = meter.createUpDownCounter("http_requests_active", {
  description: "Number of active HTTP requests",
});

// Telemetry middleware
const telemetryMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Increment active requests
  activeRequests.add(1);
  
  // Create a span for this request
  const span = tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
    attributes: {
      "http.method": req.method,
      "http.url": req.url,
      "http.route": req.route?.path || req.path,
      "http.user_agent": req.get("User-Agent") || "",
      "http.remote_addr": req.ip || req.connection.remoteAddress,
    },
  });

  // Set span in context
  trace.setSpan(context.active(), span);

  // Log request start
  logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: "INFO",
    body: "HTTP request started",
    attributes: {
      method: req.method,
      url: req.url,
      userAgent: req.get("User-Agent") || "",
      remoteAddr: req.ip || req.connection.remoteAddress,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
    },
  });

  // Override res.end to capture response data
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Set span attributes for response
    span.setAttributes({
      "http.status_code": res.statusCode,
      "http.response_size": res.get("Content-Length") || 0,
    });

    // Set span status based on HTTP status code
    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Record metrics
    requestCounter.add(1, {
      method: req.method,
      status_code: res.statusCode.toString(),
      route: req.route?.path || req.path,
    });

    requestDuration.record(duration, {
      method: req.method,
      status_code: res.statusCode.toString(),
      route: req.route?.path || req.path,
    });

    // Decrement active requests
    activeRequests.add(-1);

    // Log request completion
    logger.emit({
      severityNumber: res.statusCode >= 400 ? SeverityNumber.WARN : SeverityNumber.INFO,
      severityText: res.statusCode >= 400 ? "WARN" : "INFO",
      body: "HTTP request completed",
      attributes: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: duration,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
      },
    });

    // End the span
    span.end();

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

module.exports = telemetryMiddleware;
