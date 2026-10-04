import type { CartDiscountsCalculate, CartDiscountsLine } from '@salla.sa/app-functions-types';
import { describe, expect, test } from 'vitest';
import events from '../src';
import { cartDiscountsCalculate } from '../src/functions/cart-discounts-calculate';

const line = (id: number, quantity: number, unitPrice: string, remaining?: string): CartDiscountsLine => ({
  id,
  product_id: id * 100,
  variant_id: null,
  quantity,
  unit_price: unitPrice,
  line_subtotal: (Number(unitPrice) * quantity).toFixed(2),
  remaining_amount: remaining ?? (Number(unitPrice) * quantity).toFixed(2),
  categories: [],
  brand: null,
  tags: []
});

const ctx = (lines: CartDiscountsLine[], settings: CartDiscountsCalculate['settings'] = {}): CartDiscountsCalculate =>
  ({
    payload: {
      event: 'cart.discounts.calculate.run',
      created_at: '2026-10-04T10:00:00Z',
      merchant: 1234,
      data: {
        context: 'cart',
        fingerprint: 'sha256:abc',
        offer: { id: 501, caps: { max_amount: '100.00', max_percent: 50 } },
        cart: {
          id: 9001,
          currency_code: 'SAR',
          channel: 'browser',
          market: { scope_id: null },
          tax_mode: 'inclusive',
          entered_discount_codes: [],
          lines
        },
        buyer: { customer_id: null, is_guest: true, customer_groups: [] }
      }
    },
    merchant: { id: 1234 },
    settings
  }) as CartDiscountsCalculate;

const data = async (context: CartDiscountsCalculate) => {
  const response = await cartDiscountsCalculate(context);

  if (!response.success) {
    throw new Error('expected a successful response');
  }

  return response.data;
};

describe('cart.discounts.calculate.run', () => {
  test('is registered in the events map', () => {
    expect(events['cart.discounts.calculate.run']).toBe(cartDiscountsCalculate);
  });

  test('gives no discount to a small cart', async () => {
    expect((await data(ctx([line(1, 1, '50.00')]))).operations).toEqual([]);
  });

  test('discounts every line bought in bulk', async () => {
    const result = await data(ctx([line(1, 2, '50.00'), line(2, 1, '20.00'), line(3, 5, '10.00')]));

    expect(result.operations).toEqual([
      {
        productDiscountsAdd: {
          selectionStrategy: 'ALL',
          candidates: [
            {
              message: { ar: 'خصم الكمية 10%', en: '10% bulk discount' },
              targets: [{ cartLine: { id: 1, quantity: 2 } }, { cartLine: { id: 3, quantity: 5 } }],
              value: { percentage: { value: '10' } }
            }
          ]
        }
      }
    ]);
  });

  test('adds an order discount above the threshold, measured on what is left after coupons', async () => {
    const above = await data(ctx([line(1, 1, '320.00')]));
    const belowAfterCoupon = await data(ctx([line(1, 1, '320.00', '290.00')]));

    expect(above.operations).toEqual([
      {
        orderDiscountsAdd: {
          selectionStrategy: 'FIRST',
          candidates: [
            {
              message: { ar: 'خصم 15.00 SAR على الطلب', en: '15.00 SAR off your order' },
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
              value: { fixedAmount: { amount: '15.00', currencyCode: 'SAR' } }
            }
          ]
        }
      }
    ]);
    expect(belowAfterCoupon.operations).toEqual([]);
  });

  test('reads its numbers from the merchant app settings', async () => {
    const result = await data(
      ctx([line(1, 3, '40.00')], { bulk_min_quantity: 3, bulk_percent: 20, order_threshold: 100, order_fixed_amount: 7.5 })
    );

    expect(result.operations).toHaveLength(2);
    expect(result.operations[0]).toMatchObject({
      productDiscountsAdd: { candidates: [{ value: { percentage: { value: '20' } } }] }
    });
    expect(result.operations[1]).toMatchObject({
      orderDiscountsAdd: { candidates: [{ value: { fixedAmount: { amount: '7.50', currencyCode: 'SAR' } } }] }
    });
  });

  test('falls back to defaults when settings are missing or invalid', async () => {
    const result = await data(ctx([line(1, 2, '10.00')], { bulk_min_quantity: 'many', bulk_percent: 500 }));

    expect(result.operations[0]).toMatchObject({
      productDiscountsAdd: { candidates: [{ value: { percentage: { value: '10' } } }] }
    });
  });

  test('stays within the candidate limit for a very large cart', async () => {
    const lines = Array.from({ length: 80 }, (_, index) => line(index + 1, 2, '5.00'));
    const result = await data(ctx(lines));

    expect(result.operations[0]).toMatchObject({ productDiscountsAdd: { candidates: [{}] } });
    expect((result.operations[0] as { productDiscountsAdd: { candidates: unknown[] } }).productDiscountsAdd.candidates).toHaveLength(1);
  });

  test('sends percentages and amounts with at most 2 decimals', async () => {
    const result = await data(ctx([line(1, 2, '400.00')], { bulk_percent: 33.3333, order_fixed_amount: 12.345 }));
    const pattern = /^\d{1,12}(\.\d{1,2})?$/;

    expect(result.operations[0]).toMatchObject({ productDiscountsAdd: { candidates: [{ value: { percentage: { value: '33.33' } } }] } });
    expect(result.operations[1]).toMatchObject({ orderDiscountsAdd: { candidates: [{ value: { fixedAmount: { amount: '12.35' } } }] } });
    expect('33.33').toMatch(pattern);
  });

  test('returns a reference and a cache time Salla can use', async () => {
    const result = await data(ctx([line(1, 1, '10.00')]));

    expect(result.reference).toBe('bulk-sha256:abc');
    expect(result.ttl_seconds).toBe(300);
  });
});
