const rootService = require("../services/rootService");
const logger = require("../utils/logger");

const getRootData = (req, res) => {
	try {
		const apiRootData = rootService.getRootData(req);

		if (!apiRootData) {
			logger.warn("Root API data not found", {
				requestId: req.requestId
			});
			return res.status(404).json({ message: "Root API data not found" });
		}

		logger.info("Root API data retrieved successfully", {
			requestId: req.requestId
		});

		return res.status(200).json({ message: "ok", result: apiRootData });
	} catch (error) {
		logger.error("Failed to get root API data", error, {
			requestId: req.requestId
		});

		return res
			.status(400)
			.json({ message: "Could not GET root data", errors: `${error}` });
	}
};

module.exports = {
	getRootData,
};
