import { describe, expect, it } from 'vitest';
import { getSessionsForRequest } from './sessionResults';

describe('getSessionsForRequest', () => {
  it('does not expose results from another filter request', () => {
    const staleSessions = [{ id: 'old-filter-session' }];

    expect(getSessionsForRequest({ key: 'old', sessions: staleSessions }, 'new')).toEqual([]);
  });

  it('returns results only for the matching request key', () => {
    const sessions = [{ id: 'current-session' }];

    expect(getSessionsForRequest({ key: 'current', sessions }, 'current')).toBe(sessions);
  });
});