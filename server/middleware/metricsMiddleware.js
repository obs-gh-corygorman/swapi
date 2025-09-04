const { SeverityNumber } = require("@opentelemetry/api-logs");

// Lazy initialization of metrics to avoid circular dependency
let httpRequestsTotal;
let httpRequestDuration;
let httpRequestsInFlight;
let activeConnections;
let logger;

function initializeMetrics() {
  if (!httpRequestsTotal) {
    const { meter, logger: loggerInstance } = require("../index");
    logger = loggerInstance;

    httpRequestsTotal = meter.createCounter("http_requests_total", {
      description: "Total number of HTTP requests",
    });

    httpRequestDuration = meter.createHistogram("http_request_duration_seconds", {
      description: "Duration of HTTP requests in seconds",
    });

    httpRequestsInFlight = meter.createUpDownCounter("http_requests_in_flight", {
      description: "Number of HTTP requests currently being processed",
    });

    activeConnections = meter.createUpDownCounter("http_active_connections", {
      description: "Number of active HTTP connections",
    });
  }
}

// Middleware to collect HTTP metrics
const metricsMiddleware = (req, res, next) => {
  // Initialize metrics on first request
  initializeMetrics();
  const startTime = Date.now();
  
  // Increment in-flight requests
  httpRequestsInFlight.add(1, {
    method: req.method,
    route: req.route?.path || req.path,
  });

  // Increment active connections
  activeConnections.add(1);

  // Log request start
  logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: "INFO",
    body: "HTTP request started",
    attributes: {
      "http.method": req.method,
      "http.url": req.url,
      "http.route": req.route?.path || req.path,
      "http.user_agent": req.get("User-Agent"),
      "http.remote_addr": req.ip,
    },
  });

  // Override res.end to capture metrics when response is sent
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const statusCode = res.statusCode;
    const statusClass = `${Math.floor(statusCode / 100)}xx`;

    // Record metrics
    httpRequestsTotal.add(1, {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: statusCode.toString(),
      status_class: statusClass,
    });

    httpRequestDuration.record(duration, {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: statusCode.toString(),
    });

    // Decrement in-flight requests
    httpRequestsInFlight.add(-1, {
      method: req.method,
      route: req.route?.path || req.path,
    });

    // Decrement active connections
    activeConnections.add(-1);

    // Log request completion
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "HTTP request completed",
      attributes: {
        "http.method": req.method,
        "http.url": req.url,
        "http.route": req.route?.path || req.path,
        "http.status_code": statusCode,
        "http.response_time_ms": Date.now() - startTime,
        "http.response_size": res.get("Content-Length") || 0,
      },
    });

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

module.exports = metricsMiddleware;
