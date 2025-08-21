const { trace, metrics } = require('@opentelemetry/api');
const logger = require('../utils/logger');

// Create a meter for custom metrics
const meter = metrics.getMeter('swapi-server', '1.0.0');

// Define custom metrics
const httpRequestDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'Duration of HTTP requests in milliseconds',
  unit: 'ms',
});

const httpRequestsTotal = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

const activeConnections = meter.createUpDownCounter('http_active_connections', {
  description: 'Number of active HTTP connections',
});

const databaseOperations = meter.createCounter('database_operations_total', {
  description: 'Total number of database operations',
});

const databaseOperationDuration = meter.createHistogram('database_operation_duration_ms', {
  description: 'Duration of database operations in milliseconds',
  unit: 'ms',
});

/**
 * Middleware for request logging and metrics
 */
const requestTelemetry = (req, res, next) => {
  const startTime = Date.now();
  
  // Increment active connections
  activeConnections.add(1);
  
  // Get current span to add custom attributes
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes({
      'http.route': req.route?.path || req.path,
      'user.agent': req.get('User-Agent') || '',
      'http.client_ip': req.ip,
    });
  }

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Record metrics
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
    };
    
    httpRequestsTotal.add(1, labels);
    httpRequestDuration.record(responseTime, labels);
    activeConnections.add(-1);
    
    // Log request
    logger.logRequest(req, res, responseTime);
    
    // Add span attributes for response
    if (span) {
      span.setAttributes({
        'http.response.status_code': res.statusCode,
        'http.response.duration_ms': responseTime,
      });
      
      // Set span status based on HTTP status code
      if (res.statusCode >= 400) {
        span.recordException(new Error(`HTTP ${res.statusCode}`));
        span.setStatus({
          code: trace.SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      }
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Middleware to add request ID for correlation
 */
const requestId = (req, res, next) => {
  const span = trace.getActiveSpan();
  const requestId = span ? span.spanContext().spanId : Math.random().toString(36).substr(2, 9);
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Database operation wrapper for metrics and logging
 */
const wrapDatabaseOperation = (operation, collection) => {
  return async (query, options = {}) => {
    const startTime = Date.now();
    const span = trace.getActiveSpan();
    
    try {
      if (span) {
        span.setAttributes({
          'db.operation': operation,
          'db.collection.name': collection,
          'db.query': JSON.stringify(query),
        });
      }
      
      const result = await operation.call(this, query, options);
      const duration = Date.now() - startTime;
      
      // Record metrics
      databaseOperations.add(1, {
        operation: operation.name,
        collection,
        status: 'success',
      });
      databaseOperationDuration.record(duration, {
        operation: operation.name,
        collection,
      });
      
      // Log operation
      logger.logDatabase(operation.name, collection, query, result);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metrics
      databaseOperations.add(1, {
        operation: operation.name,
        collection,
        status: 'error',
      });
      databaseOperationDuration.record(duration, {
        operation: operation.name,
        collection,
      });
      
      // Log error
      logger.error(`Database operation failed: ${operation.name}`, error, {
        database: { operation: operation.name, collection, query }
      });
      
      if (span) {
        span.recordException(error);
        span.setStatus({
          code: trace.SpanStatusCode.ERROR,
          message: error.message,
        });
      }
      
      throw error;
    }
  };
};

module.exports = {
  requestTelemetry,
  requestId,
  wrapDatabaseOperation,
  // Export metrics for use in other modules
  metrics: {
    httpRequestDuration,
    httpRequestsTotal,
    activeConnections,
    databaseOperations,
    databaseOperationDuration,
  }
};
