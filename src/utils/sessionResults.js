const EMPTY_SESSIONS = [];

export const getSessionsForRequest = (result, requestKey) => (
  result?.key === requestKey ? result.sessions : EMPTY_SESSIONS
);