import type { Customer, FunctionResponse } from '@salla.sa/app-functions-types';

/**
 * Handler for the `customer.login` event — runs when a customer signs in to a
 * merchant's store.
 *
 * The contract is identical to every other handler (see `order-created.ts` for
 * the full walk-through); only the `context` type changes to `Customer`, so
 * `context.payload.data` is now the customer record instead of an order.
 *
 * This example is intentionally trivial — it just reflects a few fields back in
 * the response. Swap the body for your own logic (e.g. sync the customer to a
 * CRM, award loyalty points, …).
 */
export const customerLogin = (context: Customer): FunctionResponse => {
  console.info('customer.login event invoked');

  const customer = context.payload.data;

  return {
    success: true,
    status: 200,
    message: `Customer ${customer.id} logged in`,
    data: {
      customerId: customer.id,
      name: `${customer.first_name} ${customer.last_name}`,
      email: customer.email,
      country: customer.country
    }
  };
};
