import type { FunctionResponse, Order } from '@salla.sa/app-functions-types';

// `context` is typed as `Order`; the explicit `: FunctionResponse` return type
// makes the editor red-line any return that isn't a valid Success/Error response.
export const orderCreated = (context: Order): FunctionResponse => {
  const order = context.payload.data;
  console.log('Order Created Event Invoked');
  console.info('Order created event invoked with data:', order.id);

  const items = order.items;
  const isItemsPresent = items && items.length > 0;
  if (!isItemsPresent) {
    console.error('Order created event invoked without items');
    return {
      success: false,
      status: 400,
      message: 'No items found in the order',
      error: {
        fields: {
          items: ['The order must contain at least one item.']
        },
        message: 'The order does not contain any items.'
      }
    };
  }

  console.log(`Order created with ${items.length} items`);

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
