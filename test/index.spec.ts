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
type CustomerData = Customer['payload']['data'];

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

/**
 * Builds a `customer.login` context. Pass an optional `overrides` object to
 * tweak any customer field (e.g. drop the last name, or change the country).
 */
const customerCtx = (overrides: DeepPartial<CustomerData> = {}): Customer =>
  fixture<Customer>({
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
        is_notifications_enabled: true,
        ...overrides
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
    const res = await events['customer.login'](customerCtx());
    expect(res).toMatchObject({
      success: true,
      status: 200,
      data: { customerId: 7, name: 'Sara Ali', email: 'sara@example.com', country: 'Saudi Arabia' }
    });
  });
});

describe('order.created edge cases', () => {
  test('counts every line item, not just the first', async () => {
    const res = await events['order.created'](
      orderCtx([
        { id: 1, name: 'Widget', sku: 'W-1', quantity: 2, currency: 'SAR' },
        { id: 2, name: 'Gadget', sku: 'G-1', quantity: 1, currency: 'SAR' },
        { id: 3, name: 'Gizmo', sku: 'Z-1', quantity: 5, currency: 'SAR' }
      ])
    );
    expect(res).toMatchObject({ success: true, status: 200, data: { itemCount: 3 } });
  });

  test('treats a non-array `items` as zero items instead of throwing', async () => {
    // A malformed payload where `items` is missing entirely. The handler guards
    // with `Array.isArray`, so it must fall back to 0 rather than blow up on
    // `.length`.
    const res = await events['order.created'](orderCtx([], { items: undefined }));
    expect(res).toMatchObject({ success: true, status: 200, data: { itemCount: 0 } });
  });

  test('echoes the reference id back in the success message', async () => {
    const res = await events['order.created'](
      orderCtx([{ id: 1, name: 'Widget', sku: 'W-1', quantity: 1, currency: 'SAR' }], {
        reference_id: 88888
      })
    );
    expect(res).toMatchObject({
      success: true,
      message: 'Order 88888 received',
      data: { reference: 88888 }
    });
  });

  test('builds the customer full name from first and last name', async () => {
    const res = await events['order.created'](
      orderCtx([], { customer: { first_name: 'Mona', last_name: 'Zaid' } })
    );
    expect(res).toMatchObject({ success: true, data: { customer: 'Mona Zaid' } });
  });

  test('returns a 400 error when the order id is undefined (absent from payload)', async () => {
    // Distinct from the `id: 0` case: here the field is missing entirely, which
    // is the shape a truncated/malformed webhook actually takes.
    const res = await events['order.created'](orderCtx([], { id: undefined }));
    expect(res).toMatchObject({
      success: false,
      status: 400,
      message: 'Order ID is missing from the payload',
      error: { message: 'Order ID is missing from the payload' }
    });
  });

  test('does not leak a data field on the error response', async () => {
    const res = await events['order.created'](orderCtx([], { id: 0 }));
    expect(res.success).toBe(false);
    expect(res).not.toHaveProperty('data');
  });
});

describe('customer.login edge cases', () => {
  test('echoes the customer id back in the message', async () => {
    const res = await events['customer.login'](customerCtx({ id: 42 }));
    expect(res).toMatchObject({
      success: true,
      status: 200,
      message: 'Customer 42 logged in',
      data: { customerId: 42 }
    });
  });

  test('reflects an updated country and email', async () => {
    const res = await events['customer.login'](
      customerCtx({ email: 'omar@example.com', country: 'Kuwait' })
    );
    expect(res).toMatchObject({
      success: true,
      data: { email: 'omar@example.com', country: 'Kuwait' }
    });
  });

  test('still succeeds when optional fields (email, country) are absent', async () => {
    const res = await events['customer.login'](
      customerCtx({ email: undefined, country: undefined })
    );
    expect(res).toMatchObject({
      success: true,
      status: 200,
      data: { customerId: 7, name: 'Sara Ali' }
    });
    // Narrow the response union so we can assert on the success-only `data`
    // field: the absent inputs surface as `undefined`, not empty strings.
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toHaveProperty('email', undefined);
      expect(res.data).toHaveProperty('country', undefined);
    }
  });
});
