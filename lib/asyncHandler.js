// Wraps an async Express route handler so a thrown/rejected error (including
// DbError from lib/store.js) reaches the global error handler in server.js
// as a real HTTP error response instead of an unhandled rejection or a
// silently-swallowed failure.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
