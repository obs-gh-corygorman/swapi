// CRITICAL: Initialize OpenTelemetry FIRST before any other imports
const { initOtel, shutdownOtel } = require("./otel-server");

// Initialize OpenTelemetry
const { tracer, logger, meter } = initOtel();

// Now import and start the server
const { startServer } = require("./app");

startServer();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  shutdownOtel();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  shutdownOtel();
  process.exit(0);
});

// Export for use in other modules
module.exports = { tracer, logger, meter };
