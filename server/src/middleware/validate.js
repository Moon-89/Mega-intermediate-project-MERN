import ApiError from '../utils/ApiError.js';

/**
 * Validates and replaces req[source] with the parsed result.
 * Rejects with 422 and a field-by-field breakdown.
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || source,
      message: issue.message,
    }));
    return next(ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', details));
  }
  if (source === 'query') {
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  next();
};

/** 400 unless the named route param looks like a Mongo ObjectId. */
export const objectIdParam = (name = 'id') => (req, _res, next) => {
  const value = req.params[name];
  if (!/^[0-9a-fA-F]{24}$/.test(value || '')) {
    return next(ApiError.badRequest(`'${value}' is not a valid id`, 'INVALID_ID'));
  }
  next();
};
