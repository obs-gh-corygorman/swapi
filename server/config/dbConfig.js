const mongoose = require("mongoose");
const { SeverityNumber } = require("@opentelemetry/api-logs");
const { logger } = require("../otel");

const MONGODB_URI =
	process.env.NODE_ENV === "production"
		? process.env.MONGODB_URI
		: "mongodb://127.0.0.1:27017/swapi";

module.exports = () => {
	mongoose
		.connect(MONGODB_URI)
		.then(() => {
			console.log("Connected to SWAPI DB");
			logger.emit({
				severityNumber: SeverityNumber.INFO,
				severityText: "INFO",
				body: "Successfully connected to MongoDB",
				attributes: {
					database: "swapi",
					environment: process.env.NODE_ENV || "development",
					uri: MONGODB_URI.replace(/\/\/.*@/, "//***:***@"), // Hide credentials
				},
			});
		})
		.catch((err) => {
			console.log("Error connecting: ", err);
			logger.emit({
				severityNumber: SeverityNumber.ERROR,
				severityText: "ERROR",
				body: "Failed to connect to MongoDB",
				attributes: {
					error: err.message,
					database: "swapi",
					environment: process.env.NODE_ENV || "development",
				},
			});
		});

	mongoose.connection.on("error", (err) => {
		console.log("Error after successful connection: ", err);
		logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "MongoDB connection error after successful connection",
			attributes: {
				error: err.message,
				database: "swapi",
			},
		});
	});

	mongoose.connection.on("disconnected", () => {
		logger.emit({
			severityNumber: SeverityNumber.WARN,
			severityText: "WARN",
			body: "MongoDB connection disconnected",
			attributes: {
				database: "swapi",
			},
		});
	});

	mongoose.connection.on("reconnected", () => {
		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "MongoDB connection reconnected",
			attributes: {
				database: "swapi",
			},
		});
	});
};
