const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const created = (res, data = null, message = 'Created successfully') => {
  return res.status(201).json({ success: true, message, data });
};

const error = (res, message = 'Internal server error', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const badRequest = (res, message = 'Bad request', errors = null) => error(res, message, 400, errors);

const unauthorized = (res, message = 'Unauthorized') => error(res, message, 401);

const forbidden = (res, message = 'Forbidden') => error(res, message, 403);

const notFound = (res, message = 'Resource not found') => error(res, message, 404);

const conflict = (res, message = 'Conflict') => error(res, message, 409);

module.exports = { success, created, error, badRequest, unauthorized, forbidden, notFound, conflict };