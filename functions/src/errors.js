'use strict';
// An op failure. index.js turns it into a callable HttpsError with the same status, message code and details.
class OpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'OpError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

module.exports = { OpError };
