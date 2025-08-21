// Initialize OpenTelemetry FIRST before any other imports
const { initOtel, shutdownOtel } = require("./otel");
initOtel();

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
