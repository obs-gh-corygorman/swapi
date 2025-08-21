const adClickService = require("../services/adClickService");
const logger = require("../utils/logger");

const getAdsTxt = (req, res) => {
	try {
		const adTxtFile = adClickService.getAdsTxt();
		logger.info("Served ads.txt file", {
			requestId: req.requestId,
			contentLength: adTxtFile.length
		});

		res.setHeader("Content-Type", "text/plain");
		return res.status(200).send(adTxtFile);
	} catch (error) {
		logger.error("Error reading ads.txt", error, {
			requestId: req.requestId
		});
		res.status(500).send("Unable to serve ads.txt");
	}
};

const addClick = async (req, res) => {
	const [referrer, userAgent] = [req.get("Referrer"), req.get("User-Agent")];
	const originType = req.params.originType;

	try {
		const newClick = await adClickService.addClick(
			referrer,
			userAgent,
			originType
		);

		logger.info("Click tracked successfully", {
			requestId: req.requestId,
			click: {
				originType,
				referrer,
				userAgent: userAgent?.substring(0, 100) // Truncate for logging
			}
		});

		return res.status(200).json({ message: "Click tracked", click: newClick });
	} catch (error) {
		logger.error("Failed to track click", error, {
			requestId: req.requestId,
			click: { originType, referrer }
		});

		return res
			.status(400)
			.json({ message: "Could not track click", error: error.toString() });
	}
};

const getClicks = async (req, res) => {
	try {
		const allClicks = await adClickService.getClicks();

		logger.info("Retrieved clicks data", {
			requestId: req.requestId,
			clickCount: allClicks.length
		});

		return res.status(200).json({ message: "Ok", clicks: allClicks });
	} catch (error) {
		logger.error("Failed to retrieve clicks", error, {
			requestId: req.requestId
		});

		return res
			.status(400)
			.json({ message: "something went wrong", error: error.toString() });
	}
};

module.exports = {
	addClick,
	getAdsTxt,
	getClicks,
};
