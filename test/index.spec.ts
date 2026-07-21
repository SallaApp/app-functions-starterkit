import type { Customer, Order } from '@salla.sa/app-functions-types';
import { describe, expect, test } from 'vitest';
import events from '../src';

type OrderData = Order['payload']['data'];
type OrderItem = OrderData['items'][number];

/** Recursively makes every field optional so fixtures can stay minimal while
 * the fields they DO provide are still checked against the real payload types. */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/** The full webhook payloads have dozens of required fields the handlers never
 * read; this confines the fill-in-the-rest cast to a single documented spot. */
const fixture = <T>(partial: DeepPartial<T>): T => partial as unknown as T;

// Minimal fixtures shaped like the ctx the platform SDK passes to a handler.
const orderCtx = (items: DeepPartial<OrderItem>[]): Order =>
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
        items
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
      email: '',
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
  test('registers the expected event handlers', () => {
    expect(Object.keys(events).sort()).toEqual([
      'custom.event.custom-event',
      'customer.login',
      'order.created'
    ]);
  });

  test('order.created returns a success response', async () => {
    const res = await events['order.created'](
      orderCtx([{ id: 1, name: 'Widget', sku: 'W-1', quantity: 2, currency: 'SAR' }])
    );
    expect(res).toMatchObject({
      success: true,
      status: 200,
      data: { orderId: 999, reference: 50123, total: '130 SAR', itemCount: 1 }
    });
  });

  test('order.created with no items returns a 422 error response', async () => {
    const res = await events['order.created'](orderCtx([]));
    expect(res).toMatchObject({ success: false, status: 422 });
  });

  test('customer.login returns a success response', async () => {
    const res = await events['customer.login'](customerCtx);
    expect(res).toMatchObject({
      success: true,
      data: { customerId: 7, name: 'Sara Ali', email: 'sara@example.com' }
    });
  });
});
