const path = require("path");
const express = require("express");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const dbConfig = require("../config/dbConfig");
const applyMiddleware = require("./middleware");
const applyRoutes = require("./routes");
const { applyConfig } = require("../config/config");
const logger = require("../utils/logger");

const app = express();
const PORT = process.env.PORT || 5000;

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
		logger.info('Server started successfully', {
			port: PORT,
			environment: process.env.NODE_ENV || 'development',
			nodeVersion: process.version,
		});
	});
};

module.exports = { startServer, app };
