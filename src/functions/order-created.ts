import type { FunctionResponse, Order } from '@salla.sa/app-functions-types';

// `context` is typed as `Order`; the explicit `: FunctionResponse` return type
// makes the editor red-line any return that isn't a valid Success/Error response.
export const orderCreated = (context: Order): FunctionResponse => {
  const order = context.payload.data;

  // Returning an error response is just as easy: { success:false, message, error }.
  if (order.items.length === 0) {
    return {
      success: false,
      status: 422,
      message: 'Order has no items',
      error: { message: 'Order has no items' }
    };
  }

  const total = `${order.amounts.total.amount} ${order.amounts.total.currency}`;
  return {
    success: true,
    status: 200,
    message: `Order ${order.reference_id} received (${total})`,
    data: {
      orderId: order.id,
      reference: order.reference_id,
      total,
      customer: `${order.customer.first_name} ${order.customer.last_name}`,
      itemCount: order.items.length
    }
  };
};
