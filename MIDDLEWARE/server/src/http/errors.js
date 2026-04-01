class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function notFound(resource, id) {
  return new HttpError(404, 'NOT_FOUND', `${resource} not found: ${id}`);
}

module.exports = {
  HttpError,
  notFound
};
