import type { Customer, FunctionResponse } from '@salla.sa/app-functions-types';

export const customerLogin = (context: Customer): FunctionResponse => {
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
