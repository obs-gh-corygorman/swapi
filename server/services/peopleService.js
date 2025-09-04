const { trace, context, SpanStatusCode } = require("@opentelemetry/api");
const { SeverityNumber } = require("@opentelemetry/api-logs");
const { tracer, logger } = require("../index");

const Paginate = require("../helpers/pagination");
const People = require("../models/PeopleModel");

// Get All
const getAllPeople = async (req, page, limit) => {
	const span = tracer.startSpan("people.service.getAllPeople");

	try {
		trace.setSpan(context.active(), span);
		span.setAttributes({
			"db.operation": "find",
			"db.collection.name": "people",
			"people.page": page || "1",
			"people.limit": limit || "10",
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Fetching all people from database",
			attributes: {
				operation: "getAllPeople",
				page: page || "1",
				limit: limit || "10",
			},
		});

		const total = await People.countDocuments();
		span.addEvent("counted_documents", { total });

		const { pageNumber, resultLimit } = Paginate.parseSkip(page, limit, total);
		const peoplePagination = new Paginate(req, pageNumber, resultLimit, total);
		const pager = peoplePagination.paginate();

		const people = await People.find(
			{},
			{},
			{ ...peoplePagination.query, sort: { _id: 1 } },
		);

		span.setAttributes({
			"people.total_count": total,
			"people.returned_count": people.length,
			"people.page_number": pageNumber,
			"people.result_limit": resultLimit,
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Successfully fetched people from database",
			attributes: {
				operation: "getAllPeople",
				total_count: total,
				returned_count: people.length,
				page_number: pageNumber,
			},
		});

		span.setStatus({ code: SpanStatusCode.OK });
		return { pager, people };
	} catch (error) {
		span.recordException(error);
		span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

		logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "Error fetching people from database",
			attributes: {
				operation: "getAllPeople",
				error: error.message,
				stack: error.stack,
			},
		});

		throw error;
	} finally {
		span.end();
	}
};

// Get by ID
const getPersonById = async (id) => {
	const span = tracer.startSpan("people.service.getPersonById");

	try {
		trace.setSpan(context.active(), span);
		span.setAttributes({
			"db.operation": "findOne",
			"db.collection.name": "people",
			"people.id": id,
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: "Fetching person by ID from database",
			attributes: {
				operation: "getPersonById",
				id: id,
			},
		});

		const person = await People.findOne({ uid: id });

		span.setAttributes({
			"people.found": !!person,
			"people.name": person?.properties?.name,
		});

		logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: "INFO",
			body: person ? "Successfully found person" : "Person not found",
			attributes: {
				operation: "getPersonById",
				id: id,
				found: !!person,
				name: person?.properties?.name,
			},
		});

		span.setStatus({ code: SpanStatusCode.OK });
		return person;
	} catch (error) {
		span.recordException(error);
		span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

		logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: "ERROR",
			body: "Error fetching person from database",
			attributes: {
				operation: "getPersonById",
				id: id,
				error: error.message,
				stack: error.stack,
			},
		});

		throw error;
	} finally {
		span.end();
	}
};

module.exports = {
	getAllPeople,
	getPersonById,
};
