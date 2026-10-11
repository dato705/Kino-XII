import { beforeEach, describe, expect, it } from 'vitest';
import { clearIdempotencyKey, getIdempotencyKey } from './idempotency';

describe('idempotency keys', () => {
  beforeEach(() => sessionStorage.clear());

  it('reuses the same key for retries of one operation', () => {
    const first = getIdempotencyKey('order:hold-1');
    const retry = getIdempotencyKey('order:hold-1');

    expect(retry).toBe(first);
    expect(sessionStorage.getItem('kinoxii:idempotency:order:hold-1')).toBe(first);
  });

  it('uses different keys for separate operations and renews after success', () => {
    const first = getIdempotencyKey('refund:order-1');
    const other = getIdempotencyKey('refund:order-2');
    clearIdempotencyKey('refund:order-1');

    expect(other).not.toBe(first);
    expect(getIdempotencyKey('refund:order-1')).not.toBe(first);
  });
});