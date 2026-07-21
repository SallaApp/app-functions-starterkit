/**
 * App Functions entry point.
 *
 * This file exports the single **events map** that Salla loads at runtime.
 * The map binds each Salla event name to the handler that should run when that
 * event fires inside a merchant's store. Everything else in `src/functions/` is
 * just the handlers this map points at.
 */
import type { DefineEvents } from '@salla.sa/app-functions-types';
import { customerLogin } from './functions/customer-login';
import { orderCreated } from './functions/order-created';

/**
 * `@salla.sa/app-functions-types` is a *types-only* package — it ships no
 * runtime code. So `defineEvents` is just the identity function, but typed with
 * the package's `DefineEvents` signature so the compiler enforces the event-map
 * contract for us:
 *
 *   • keys must be a known Salla event (e.g. `order.created`, `customer.login`,
 *     `product.created`, …) an unrecognized key is a compile error — the map's type
 *     collapses to `never`, so `npm run typecheck` fails before you ever deploy a typo.
 */
const defineEvents: DefineEvents = (events) => events;

/**
 * The events map. To wire up a new event:
 *   1. create `src/functions/<your-handler>.ts` exporting a handler function;
 *   2. import it above;
 *   3. add a `'<salla.event>': yourHandler` entry below.
 *
 * A handler is only ever invoked for the event it's registered against, so the
 * `context` argument's type is pinned by the event name.
 */
const events = defineEvents({
  'order.created': orderCreated,
  'customer.login': customerLogin
});

// The Salla runtime imports this default export and dispatches every event to its handler.
export default events;
