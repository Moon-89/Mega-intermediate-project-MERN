import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../middleware/auth.js';

// POST /api/auth/register -> 201
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('That email is already registered', 'EMAIL_TAKEN');
  }

  const user = new User({ name, email, phone, role: 'user' });
  await user.setPassword(password);
  await user.save();

  res.status(201).json({ data: { user: user.toJSON(), token: signToken(user) } });
});

// POST /api/auth/login -> 200
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(password))) {
    throw ApiError.unauthorized('Email or password is incorrect', 'BAD_CREDENTIALS');
  }

  res.status(200).json({ data: { user: user.toJSON(), token: signToken(user) } });
});

// GET /api/auth/me -> 200
export const me = asyncHandler(async (req, res) => {
  res.status(200).json({ data: req.user.toJSON() });
});

// PATCH /api/auth/me -> 200
export const updateMe = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.status(200).json({ data: req.user.toJSON() });
});

// POST /api/auth/change-password -> 200
export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.verifyPassword(req.body.currentPassword))) {
    throw ApiError.unauthorized('Current password is incorrect', 'BAD_CREDENTIALS');
  }
  await user.setPassword(req.body.newPassword);
  await user.save();
  res.status(200).json({ data: { message: 'Password updated' } });
});
