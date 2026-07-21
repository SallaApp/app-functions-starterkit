import type { FunctionResponse, Order } from '@salla.sa/app-functions-types';

/**
 * Handler for the `order.created` event.
 *
 * Every handler follows the same contract: it receives the typed event
 * `context` (the order lives at `context.payload.data`) and returns a
 * `FunctionResponse` — either a success or an error. Handlers may also be
 * `async` and return a `Promise<FunctionResponse>`.
 */
export const orderCreated = (context: Order): FunctionResponse => {
  const order = context.payload.data;

  // Return an error response when the payload isn't usable.
  if (!order.id) {
    const message = 'Order ID is missing from the payload';
    console.error(message);
    return { success: false, status: 400, message, error: { message } };
  }

  // Do your work here — call an API, enqueue a job, enrich the order, …
  console.log(`Order created with ID: ${order.id}`);

  if (!Array.isArray(order.items) || order.items.length <= 0) {
    console.warn('Order has no items');
  }

  // Return a success response. `data` is free-form.
  return {
    success: true,
    status: 200,
    message: `Order ${order.reference_id} received`,
    data: {
      orderId: order.id,
      reference: order.reference_id,
      customer: `${order.customer.first_name} ${order.customer.last_name}`
    }
  };
};
