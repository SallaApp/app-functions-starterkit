import { customEvent } from './functions/custom-event';
import { customerLogin } from './functions/customer-login';
import { orderCreated } from './functions/order-created';
import type { Events } from '@salla.sa/app-functions-types';

/** Maps each Salla event name to the handler that runs when it fires.
 * The `satisfies Events` check keeps the keys and handler signatures in sync
 * with the `Events` type — a wrong event name or mismatched handler red-lines here. */
const events = {
  'order.created': orderCreated,
  'customer.login': customerLogin,
  'custom.event.custom-event': customEvent
} satisfies Events;

// Default export is the registry the runtime uses to dispatch incoming events.
export default events;
