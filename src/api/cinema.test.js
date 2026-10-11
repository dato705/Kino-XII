import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('./axios', () => ({ default: { post } }));

import { createOrder, createSeatHold, notifyMovie, refundOrder } from './cinema';

describe('idempotent mutation requests', () => {
  beforeEach(() => post.mockReset());

  it('sends the stable key for order creation', () => {
    const order = { holdId: 'hold-1' };
    createOrder(order, 'order-key');

    expect(post).toHaveBeenCalledWith('/orders', order, { headers: { 'Idempotency-Key': 'order-key' } });
  });

  it('sends the stable key for seat holds, refunds, and notifications', () => {
    const seats = [{ seatId: 8, ticketType: 'adult' }];
    createSeatHold(12, seats, 'hold-key');
    refundOrder('order-1', 'refund-key');
    notifyMovie('movie-1', 'notification-key');

    expect(post).toHaveBeenNthCalledWith(1, '/sessions/12/holds', { seats }, { headers: { 'Idempotency-Key': 'hold-key' } });
    expect(post).toHaveBeenNthCalledWith(2, '/orders/order-1/refund', null, { headers: { 'Idempotency-Key': 'refund-key' } });
    expect(post).toHaveBeenNthCalledWith(3, '/movies/movie-1/notify', null, { headers: { 'Idempotency-Key': 'notification-key' } });
  });
});