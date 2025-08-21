const { trace, context } = require('@opentelemetry/api');

/**
 * Structured logger with OpenTelemetry trace correlation
 */
class Logger {
  constructor() {
    this.serviceName = 'swapi-server';
  }

  /**
   * Get current trace and span context for correlation
   */
  getTraceContext() {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags,
      };
    }
    return {};
  }

  /**
   * Create a structured log entry
   */
  createLogEntry(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const traceContext = this.getTraceContext();
    
    return {
      timestamp,
      level,
      message,
      service: this.serviceName,
      ...traceContext,
      ...meta,
    };
  }

  /**
   * Log at info level
   */
  info(message, meta = {}) {
    const logEntry = this.createLogEntry('info', message, meta);
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log at warn level
   */
  warn(message, meta = {}) {
    const logEntry = this.createLogEntry('warn', message, meta);
    console.warn(JSON.stringify(logEntry));
  }

  /**
   * Log at error level
   */
  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : {};
    
    const logEntry = this.createLogEntry('error', message, { ...errorMeta, ...meta });
    console.error(JSON.stringify(logEntry));
  }

  /**
   * Log at debug level
   */
  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const logEntry = this.createLogEntry('debug', message, meta);
      console.debug(JSON.stringify(logEntry));
    }
  }

  /**
   * Log HTTP request details
   */
  logRequest(req, res, responseTime) {
    const logEntry = this.createLogEntry('info', 'HTTP Request', {
      http: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        ip: req.ip,
        responseTime: `${responseTime}ms`,
      },
      request: {
        params: req.params,
        query: req.query,
      }
    });
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log database operations
   */
  logDatabase(operation, collection, query = {}, result = {}) {
    const logEntry = this.createLogEntry('info', 'Database Operation', {
      database: {
        operation,
        collection,
        query: JSON.stringify(query),
        resultCount: result.length || (result.acknowledged ? 1 : 0),
      }
    });
    console.log(JSON.stringify(logEntry));
  }
}

// Export singleton instance
module.exports = new Logger();
