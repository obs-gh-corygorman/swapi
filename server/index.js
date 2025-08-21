// Initialize OpenTelemetry first, before any other imports
const { initializeOpenTelemetry } = require("./otel");
initializeOpenTelemetry();

const { startServer } = require("./app");

startServer();
