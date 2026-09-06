import ApiError from '../utils/ApiError.js';

/** Small in-memory fixed-window limiter — enough to blunt credential stuffing in dev. */
export function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref?.();

  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return next(ApiError.tooMany());
    }
    next();
  };
}
