const ALLOWED_USERS = new Set(
  Array.from({ length: 10 }, (_, i) => `user${i + 1}`)
);

export function demoUser(req, res, next) {
  const userId = req.header('x-user-id');

  if (!userId || !ALLOWED_USERS.has(userId)) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing x-user-id header',
    });
  }

  req.user = { id: userId };
  next();
}
