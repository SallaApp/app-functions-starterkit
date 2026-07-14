import type { DefineEvents } from '@salla.sa/app-functions-types';
import { customEvent } from './functions/custom-event';
import { customerLogin } from './functions/customer-login';
import { orderCreated } from './functions/order-created';

/** The types package ships no runtime code, so we provide the trivial identity
 * implementation and borrow its `DefineEvents` signature — any key that isn't a
 * known Salla event or a valid `custom.event.*` name red-lines here. */
const defineEvents: DefineEvents = (events) => events;

/** Maps each Salla event name to the handler that runs when it fires. */
const events = defineEvents({
  'order.created': orderCreated,
  'customer.login': customerLogin,
  'custom.event.custom-event': customEvent
});

// Default export is the registry the runtime uses to dispatch incoming events.
export default events;
