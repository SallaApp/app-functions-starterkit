import type { Customer, Order } from '@salla.sa/app-functions-types';
import { describe, expect, test } from 'vitest';
import events from '../src';

/*
 * These tests exercise the handlers exactly the way the platform does: they
 * look each handler up in the exported `events` map and call it with a context
 * object. Use them as a template — copy a block, swap in your event, and assert
 * on the response your handler returns.
 *
 * The tricky part of testing handlers is that the real webhook payloads have
 * dozens of required fields your handler never reads. The helpers below let you
 * write *minimal* fixtures (just the fields under test) while keeping full type
 * safety on the fields you do provide.
 */

type OrderData = Order['payload']['data'];
type OrderItem = OrderData['items'][number];

/** Recursively makes every field optional so a fixture can stay minimal while
 *  the fields it DOES provide are still checked against the real payload types. */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/** Confines the "fill in the fields I didn't bother to set" cast to one spot,
 *  so the unsafe `as unknown as T` never leaks into individual tests. */
const fixture = <T>(partial: DeepPartial<T>): T => partial as unknown as T;

/**
 * Builds an `order.created` context. Pass the line `items` you want, plus an
 * optional `overrides` object to tweak any other order field (e.g. drop the id
 * to exercise the validation path).
 */
const orderCtx = (
  items: DeepPartial<OrderItem>[],
  overrides: DeepPartial<OrderData> = {}
): Order =>
  fixture<Order>({
    payload: {
      event: 'order.created',
      created_at: '2026-01-01T00:00:00Z',
      merchant: 1234,
      data: {
        id: 999,
        reference_id: 50123,
        currency: 'SAR',
        status: { id: 1, name: 'Under review', slug: 'under_review' },
        payment_method: 'mada',
        amounts: {
          sub_total: { amount: 100, currency: 'SAR' },
          shipping_cost: { amount: 15, currency: 'SAR' },
          tax: { percent: '15', amount: { amount: 15, currency: 'SAR' } },
          total: { amount: 130, currency: 'SAR' }
        },
        customer: {
          id: 7,
          first_name: 'Sara',
          last_name: 'Ali',
          email: 'sara@example.com',
          mobile: 555000111,
          mobile_code: '+966'
        },
        items,
        ...overrides
      }
    },
    merchant: { id: 1234 },
    settings: {}
  });

const customerCtx: Customer = fixture<Customer>({
  payload: {
    event: 'customer.login',
    created_at: '2026-01-01T00:00:00Z',
    merchant: 1234,
    data: {
      id: 7,
      first_name: 'Sara',
      last_name: 'Ali',
      mobile: 111111111,
      mobile_code: '+966',
      email: 'sara@example.com',
      gender: 'female',
      city: 'Riyadh',
      country: 'Saudi Arabia',
      country_code: 'SA',
      currency: 'SAR',
      is_notifications_enabled: true
    }
  },
  merchant: { id: 1234 },
  settings: {}
});

describe('partner events map', () => {
  test('registers exactly the expected event handlers', () => {
    // Keep this in sync with `src/index.ts` — it's a cheap guard against
    // accidentally removing (or forgetting to register) a handler.
    expect(Object.keys(events).sort()).toEqual(['customer.login', 'order.created']);
  });

  test('order.created returns a success response with the order summary', async () => {
    const res = await events['order.created'](
      orderCtx([{ id: 1, name: 'Widget', sku: 'W-1', quantity: 2, currency: 'SAR' }])
    );
    expect(res).toMatchObject({
      success: true,
      status: 200,
      data: {
        orderId: 999,
        reference: 50123,
        itemCount: 1,
        customer: 'Sara Ali'
      }
    });
  });

  test('order.created still succeeds when the order has no items', async () => {
    // No items is a warning, not a failure — the handler logs and carries on.
    const res = await events['order.created'](orderCtx([]));
    expect(res).toMatchObject({ success: true, status: 200, data: { itemCount: 0 } });
  });

  test('order.created returns a 400 error when the order id is missing', async () => {
    // `id: 0` is falsy, which trips the handler's validation guard.
    const res = await events['order.created'](orderCtx([], { id: 0 }));
    expect(res).toMatchObject({
      success: false,
      status: 400,
      error: { message: 'Order ID is missing from the payload' }
    });
  });

  test('customer.login returns a success response', async () => {
    const res = await events['customer.login'](customerCtx);
    expect(res).toMatchObject({
      success: true,
      status: 200,
      data: { customerId: 7, name: 'Sara Ali', email: 'sara@example.com', country: 'Saudi Arabia' }
    });
  });
});
