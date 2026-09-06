import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { isProd } from '../config/env.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

/** Maps every thrown error onto a consistent { error: {...} } body. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_ID';
    message = `'${err.value}' is not a valid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {}).join(', ');
    message = `A record with this ${field || 'value'} already exists`;
    details = err.keyValue;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  }

  if (status >= 500 && !isProd) console.error(err);

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(status >= 500 && !isProd ? { stack: err.stack } : {}),
    },
  });
}
