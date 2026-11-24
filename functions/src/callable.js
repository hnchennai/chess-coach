'use strict';
// The callable's request handler: op errors become callable errors with the same status, message code and
// details. Anything unexpected is logged with its code and message only (a stack can hold document paths,
// and document paths can hold a uid) and the caller gets "internal".
const { HttpsError } = require('firebase-functions/v2/https');
const { OpError } = require('./errors');

function makeHandler(getOps, logError) {
  return async (request) => {
    try {
      return await getOps().handle(request.auth, request.data);
    } catch (e) {
      if (e instanceof OpError) throw new HttpsError(e.status, e.message, e.details);
      logError('friend op failed', { code: e && e.code, message: e && e.message });
      throw new HttpsError('internal', 'internal');
    }
  };
}

module.exports = { makeHandler };
