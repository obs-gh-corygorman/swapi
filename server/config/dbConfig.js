const mongoose = require("mongoose");
const logger = require("../utils/logger");

const MONGODB_URI =
	process.env.NODE_ENV === "production"
		? process.env.MONGODB_URI
		: "mongodb://127.0.0.1:27017/swapi";

module.exports = () => {
	mongoose
		.connect(MONGODB_URI)
		.then(() => {
			logger.info("Connected to SWAPI database", {
				database: {
					uri: MONGODB_URI.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
					name: "swapi"
				}
			});
		})
		.catch((err) => {
			logger.error("Failed to connect to database", err, {
				database: { uri: MONGODB_URI.replace(/\/\/.*@/, '//***:***@') }
			});
		});

	mongoose.connection.on("error", (err) => {
		logger.error("Database connection error", err);
	});
};
