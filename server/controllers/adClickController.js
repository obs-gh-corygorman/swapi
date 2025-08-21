const adClickService = require("../services/adClickService");
const { trace, context, SpanStatusCode } = require("@opentelemetry/api");
const { SeverityNumber } = require("@opentelemetry/api-logs");
const { tracer, logger } = require("../otel");

const getAdsTxt = (req, res) => {
	try {
		const adTxtFile = adClickService.getAdsTxt();
		console.log(adTxtFile);

		res.setHeader("Content-Type", "text/plain");
		return res.status(200).send(adTxtFile);
	} catch (error) {
		console.error("Error reading ads.txt:", error);
		res.status(500).send("Unable to serve ads.txt");
	}
};

const addClick = async (req, res) => {
	const span = tracer.startSpan("adClick.addClick");
	const [referrer, userAgent] = [req.get("Referrer"), req.get("User-Agent")];
	const originType = req.params.originType;

	try {
		// Set span in context and add attributes
		trace.setSpan(context.active(), span);
		span.setAttributes({
			"ad.origin_type": originType,
			"ad.referrer": referrer || "unknown",
			"ad.user_agent": userAgent || "unknown",
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Processing ad click tracking",
			attributes: {
				originType,
				referrer: referrer || "unknown",
				userAgent: userAgent || "unknown",
			},
		});

		const newClick = await adClickService.addClick(
			referrer,
			userAgent,
			originType
		);

		span.setStatus({ code: SpanStatusCode.OK });
		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Ad click tracked successfully",
			attributes: {
				clickId: newClick._id?.toString(),
				originType,
			},
		});

		return res.status(200).json({ message: "Click tracked", click: newClick });
	} catch (error) {
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message: error.message,
		});
		span.recordException(error);

		logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "Error tracking ad click",
			attributes: {
				error: error.message,
				originType,
				referrer: referrer || "unknown",
			},
		});

		console.error("Tracking Error: ", error);

		return res
			.status(400)
			.json({ message: "Could not track click", error: error.toString() });
	} finally {
		span.end();
	}
};

const getClicks = async (_, res) => {
	const span = tracer.startSpan("adClick.getClicks");

	try {
		trace.setSpan(context.active(), span);

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Retrieving all ad clicks",
		});

		const allClicks = await adClickService.getClicks();

		span.setAttributes({
			"ad.clicks_count": allClicks.length,
		});
		span.setStatus({ code: SpanStatusCode.OK });

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Ad clicks retrieved successfully",
			attributes: {
				clicksCount: allClicks.length,
			},
		});

		return res.status(200).json({ message: "Ok", clicks: allClicks });
	} catch (error) {
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message: error.message,
		});
		span.recordException(error);

		logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "Error retrieving ad clicks",
			attributes: {
				error: error.message,
			},
		});

		return res
			.status(400)
			.json({ message: "something went wrong", error: error.toString() });
	} finally {
		span.end();
	}
};

module.exports = {
	addClick,
	getAdsTxt,
	getClicks,
};
