export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: status >= 500 ? 'ERROR' : (err.code || 'REQUEST_ERROR'),
    message: status >= 500 ? 'Something went wrong' : (err.message || 'Request failed'),
  });
}
