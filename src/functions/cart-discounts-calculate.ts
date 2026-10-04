import type {
  CartDiscountOperation,
  CartDiscountsCalculate,
  CartDiscountsCalculateResponse,
  CartDiscountsLine,
  FunctionResponse
} from '@salla.sa/app-functions-types';

const DEFAULTS = {
  bulk_min_quantity: 2,
  bulk_percent: 10,
  order_threshold: 300,
  order_fixed_amount: 15
};

const QUOTE_TTL_SECONDS = 300;

const numberSetting = (
  settings: CartDiscountsCalculate['settings'],
  key: keyof typeof DEFAULTS,
  max: number
): number => {
  const value = Number(settings?.[key]);

  return Number.isFinite(value) && value > 0 && value <= max ? value : DEFAULTS[key];
};

const bulkOperation = (lines: CartDiscountsLine[], minQuantity: number, percent: number): CartDiscountOperation[] => {
  const bulkLines = lines.filter((line) => line.quantity >= minQuantity);

  if (bulkLines.length === 0) {
    return [];
  }

  return [
    {
      productDiscountsAdd: {
        selectionStrategy: 'ALL',
        candidates: [
          {
            message: { ar: `خصم الكمية ${percent}%`, en: `${percent}% bulk discount` },
            targets: bulkLines.map((line) => ({ cartLine: { id: line.id, quantity: line.quantity } })),
            value: { percentage: { value: String(percent) } }
          }
        ]
      }
    }
  ];
};

const orderOperation = (
  lines: CartDiscountsLine[],
  threshold: number,
  amount: string,
  currency: string
): CartDiscountOperation[] => {
  const remaining = lines.reduce((sum, line) => sum + Number(line.remaining_amount), 0);

  if (remaining < threshold) {
    return [];
  }

  return [
    {
      orderDiscountsAdd: {
        selectionStrategy: 'FIRST',
        candidates: [
          {
            message: { ar: `خصم ${amount} ${currency} على الطلب`, en: `${amount} ${currency} off your order` },
            targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
            value: { fixedAmount: { amount, currencyCode: currency } }
          }
        ]
      }
    }
  ];
};

export const cartDiscountsCalculate = async (
  context: CartDiscountsCalculate
): Promise<FunctionResponse<CartDiscountsCalculateResponse>> => {
  const { cart, fingerprint } = context.payload.data;
  const { settings } = context;
  const percent = Math.max(0.01, Math.round(numberSetting(settings, 'bulk_percent', 100) * 100) / 100);
  const amount = numberSetting(settings, 'order_fixed_amount', 1_000_000).toFixed(2);

  return {
    success: true,
    status: 200,
    data: {
      operations: [
        ...bulkOperation(cart.lines, numberSetting(settings, 'bulk_min_quantity', 1000), percent),
        ...orderOperation(cart.lines, numberSetting(settings, 'order_threshold', 1_000_000), amount, cart.currency_code)
      ],
      reference: `bulk-${fingerprint}`.slice(0, 100),
      ttl_seconds: QUOTE_TTL_SECONDS
    }
  };
};
