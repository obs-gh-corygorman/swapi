const path = require("path");
const express = require("express");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const dbConfig = require("../config/dbConfig");
const applyMiddleware = require("./middleware");
const applyRoutes = require("./routes");
const { applyConfig } = require("../config/config");

// Import OpenTelemetry components
const { tracer, logger, meter } = require("../otel");
const { SeverityNumber } = require("@opentelemetry/api-logs");

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize metrics
const requestCounter = meter.createCounter("http_requests_total", {
  description: "Total number of HTTP requests",
});

const requestDuration = meter.createHistogram("http_request_duration_ms", {
  description: "Duration of HTTP requests in milliseconds",
});

dbConfig();

applyConfig(app);
applyMiddleware(app);
applyRoutes(app);

if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "../../client/dist")));

	app.get("*", (req, res) => {
		res.sendFile(path.resolve(__dirname, "../../client/dist", "index.html"));
	});
}

const startServer = () => {
	app.listen(PORT, () => {
		console.log(`Server running on port ${PORT}`);

		// Log server startup with OpenTelemetry
		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "SWAPI server started successfully",
			attributes: {
				port: PORT,
				environment: process.env.NODE_ENV || "development",
				service: "swapi-server",
			},
		});
	});
};

module.exports = { startServer, app };
