const { trace, context, SpanStatusCode } = require("@opentelemetry/api");
const { SeverityNumber } = require("@opentelemetry/api-logs");
const { tracer, logger } = require("../index");

const peopleService = require("../services/peopleService");
const { setCache } = require("../utils/cache");
const withWookiee = require("../utils/wookieeEncoding");
const isWookiee = require("../utils/isWookiee");

// Get All
const getPeople = async (req, res) => {
	const span = tracer.startSpan("people.getPeople");
	const { page, limit, expanded } = req.query;

	try {
		// Set span in context and add attributes
		trace.setSpan(context.active(), span);
		span.setAttributes({
			"http.method": req.method,
			"http.route": req.route?.path || "/people",
			"people.page": page || "1",
			"people.limit": limit || "10",
			"people.expanded": expanded || "false",
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Getting all people",
			attributes: {
				operation: "getPeople",
				page: page || "1",
				limit: limit || "10",
				expanded: expanded || "false",
			},
		});

		const { people, pager } = await peopleService.getAllPeople(
			req,
			page,
			limit,
		);

		if (!people) {
			span.setStatus({ code: SpanStatusCode.ERROR, message: "People not found" });
			logger.emit({
				severityNumber: SeverityNumber.WARN,
				severityText: "WARN",
				body: "No people found",
				attributes: { operation: "getPeople" },
			});
			return res.status(404).json({ message: "People not found" });
		}

		span.setAttributes({
			"people.count": people.length,
			"people.total_records": pager.total_records,
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Successfully retrieved people",
			attributes: {
				operation: "getPeople",
				count: people.length,
				total_records: pager.total_records,
			},
		});

		span.setStatus({ code: SpanStatusCode.OK });
		return withWookiee(req, res, {
			...pager,
			results:
				expanded === "true"
					? people
					: [
							...people.map((person) => {
								return {
									uid: person.uid,
									name: person.properties.name,
									url: person.properties.url,
								};
							}),
						],
		});
	} catch (error) {
		span.recordException(error);
		span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

		logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "Error getting people",
			attributes: {
				operation: "getPeople",
				error: error.message,
				stack: error.stack,
			},
		});

		return res
			.status(400)
			.json({ message: "Could not GET people", errors: `${error}` });
	} finally {
		span.end();
	}
};

// Get by ID
const getPerson = async (req, res) => {
	const span = tracer.startSpan("people.getPerson");
	const id = req.params.id;

	try {
		// Set span in context and add attributes
		trace.setSpan(context.active(), span);
		span.setAttributes({
			"http.method": req.method,
			"http.route": req.route?.path || "/people/:id",
			"people.id": id,
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Getting person by ID",
			attributes: {
				operation: "getPerson",
				id: id,
			},
		});

		const person = await peopleService.getPersonById(id);

		if (!person) {
			span.setStatus({ code: SpanStatusCode.ERROR, message: "Person not found" });
			logger.emit({
				severityNumber: SeverityNumber.WARN,
				severityText: "WARN",
				body: "Person not found",
				attributes: { operation: "getPerson", id: id },
			});
			return res.status(404).json({ message: "not found" });
		}

		span.setAttributes({
			"people.name": person.properties?.name,
			"people.found": true,
		});

		if (!isWookiee(req)) {
			setCache(req, person.toObject());
			span.addEvent("person_cached");
		}

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Successfully retrieved person",
			attributes: {
				operation: "getPerson",
				id: id,
				name: person.properties?.name,
				cached: !isWookiee(req),
			},
		});

		span.setStatus({ code: SpanStatusCode.OK });
		return withWookiee(req, res, person);
	} catch (error) {
		span.recordException(error);
		span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

		logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "Error getting person",
			attributes: {
				operation: "getPerson",
				id: id,
				error: error.message,
				stack: error.stack,
			},
		});

		return res
			.status(400)
			.json({ message: "Could not GET person", errors: `${error}` });
	} finally {
		span.end();
	}
};

module.exports = {
	getPeople,
	getPerson,
};
