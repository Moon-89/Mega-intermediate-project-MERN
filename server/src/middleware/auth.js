import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** 401 unless a valid bearer token belongs to an existing user. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized('Missing bearer token', 'NO_TOKEN');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw ApiError.unauthorized(
      expired ? 'Session expired, please sign in again' : 'Invalid token',
      expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    );
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'USER_GONE');

  req.user = user;
  next();
});

/** Attaches req.user when a token is present, but never rejects. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = await User.findById(payload.sub);
  } catch {
    req.user = undefined;
  }
  next();
});

/** 403 unless the authenticated user holds one of the given roles. */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`This action requires the ${roles.join(' or ')} role`, 'ROLE_REQUIRED'),
      );
    }
    next();
  };
