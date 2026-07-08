/**
 * @salla.sa/functions-types  —  PUBLIC type-definition package.
 *
 * This is the ONLY thing a partner ever downloads. It contains type
 * definitions only — no SDK implementation, no runtime code. Partners author
 * their App Function against these shapes; we inject the real (private) SDK at
 * deploy time.
 *
 * For the POC we hand-define a tiny set of types. In production this package is
 * generated from the canonical defs in:
 *   cdn-salla-network/platform/functions-sdk/types/*.d.ts
 *
 * The 4 domain/response types below are copied verbatim (lightly trimmed) from
 * that source — Order, Product, Customer, GeneralResponse.
 */

/* ────────────────────────────────────────────────────────────────────────
 * 1) DOMAIN EVENT PAYLOAD TYPES  (4 types picked from cdn-salla-network)
 * ──────────────────────────────────────────────────────────────────────── */

/** order.created | order.updated | order.refunded | order.deleted | ... */
export interface Order {
  payload: {
    event: string; // e.g. "order.created"
    created_at: string;
    /** Merchant/store (ID) */
    merchant: number;
    data: {
      id: number;
      reference_id: number;
      currency: string;
      status: { id: number; name: string; slug: string };
      payment_method: string;
      amounts: {
        sub_total: { amount: number; currency: string };
        shipping_cost: { amount: number; currency: string };
        tax: { percent: string; amount: { amount: number; currency: string } };
        total: { amount: number; currency: string };
      };
      customer: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        mobile: number;
        mobile_code: string;
      };
      items: Array<{
        id: number;
        name: string;
        sku: string;
        quantity: number;
        currency: string;
      }>;
    };
  };
  merchant: { id: number | string; [key: string]: unknown };
  settings?: { [key: string]: unknown } | null;
}

export type ProductWebhookEvent =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.available'
  | 'product.quantity.low';

/** product.created | product.updated | ... */
export interface CustomEvent {
  payload: <T>;
  merchant: { id: number | string; [key: string]: unknown };
  settings?: { [key: string]: unknown } | null;
}

/** customer.created | customer.updated | customer.login */
export interface Customer {
  payload: {
    event: string; // e.g. "customer.login"
    created_at: string;
    /** Merchant/store (ID) */
    merchant: number;
    data: {
      id: number;
      first_name: string;
      last_name: string;
      mobile: number;
      mobile_code: string;
      email: string;
      gender: string;
      city: string;
      country: string;
      country_code: string;
      currency: string;
      is_notifications_enabled: boolean;
    };
  };
  merchant: { id: number | string; [key: string]: unknown };
  settings?: { [key: string]: unknown } | null;
}

/**
 * Response envelope — copied from
 * cdn-salla-network/platform/functions-sdk/types/salla-functions-sdk.d.ts.
 * Every handler returns a Success OR an Error response: { success, message, data?, error? }.
 * This is exactly what the SDK's GenericAction reads off the returned object
 * ({ status, data, message, error }) before forwarding it to the dispatcher.
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  status?: number;
  message?: string;
}
export interface ErrorResponse {
  success: false;
  status?: number;
  message: string;
  error: {
    message: string;
    fields?: Record<string, string[]>;
  };
}
export type FunctionResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/* ────────────────────────────────────────────────────────────────────────
 * 2) THE EVENTS CONTRACT  (locally defined — the shape the partner exports)
 *
 * The meeting decision: the partner exports an `events` object (NOT a handler,
 * NOT the SDK). We define the type of that object + the type of the default
 * export here so the partner has full structure available while authoring.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Every handler receives the typed event context (Order / Product / Customer)
 * and returns a Success/Error response. `TContext` is the context type. This is
 * the shape the `Events` map binds each event name to; partners can instead
 * annotate inline, e.g.
 *   export const orderCreated = (context: Order): FunctionResponse => { ... }
 * The explicit `: FunctionResponse` return type is what makes the editor
 * red-line a wrong return shape.
 */
export type EventHandler<TContext = unknown, TData = unknown> = (
  context: TContext
) => FunctionResponse<TData> | Promise<FunctionResponse<TData>>;

/**
 * The events map: keyed by Salla event name. Known events are typed to their
 * payload; the index signature allows unknown additional event name.
 */
export interface Events {
  'order.created'?: EventHandler<Order>;
  'order.updated'?: EventHandler<Order>;
  'product.created'?: EventHandler<Product>;
  'product.updated'?: EventHandler<Product>;
  'customer.login'?: EventHandler<Customer>;
  'customer.created'?: EventHandler<Customer>;
}

/**
 * The type of the partner file's DEFAULT export. The partner writes:
 *   const events = { "order.created": orderCreated, ... } satisfies Events;
 *   export default events;
 * `satisfies Events` validates the map without widening, so the default export
 * stays a concrete object that the SDK's `handler()` accepts.
 */
export type DefaultExport = Events;
