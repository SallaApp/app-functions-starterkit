# Salla App Functions — Starter kit

> **This is a starter Kit repository.** It's a starting point for building a Salla
> **App Function**, not a finished app. Clone or scaffold from it with
> [`@salla.sa/cli`](https://www.npmjs.com/package/@salla.sa/cli), replace the
> example handlers with your own, and ship.

An App Function lets your Partner app react to events that happen inside a
merchant's store (an order is created, a customer logs in, a product is added,
…). You author a small, typed handler per event; Salla runs it for you when the
event fires — no servers to manage.

## How it works

You export a single **`events` map** that binds Salla event names to handlers.
Each handler receives a typed event `context` and returns a success or error
response. That's the whole contract.

```ts
// src/index.ts
import type { DefineEvents } from '@salla.sa/app-functions-types';
import { orderCreated } from './functions/order-created';

// The types package ships no runtime code, so provide the identity
// implementation and borrow its `DefineEvents` signature for type-safety.
const defineEvents: DefineEvents = (events) => events;

const events = defineEvents({
  'order.created': orderCreated
});

export default events;
```

```ts
// src/functions/order-created.ts
import type { FunctionResponse, Order } from '@salla.sa/app-functions-types';

export const orderCreated = (context: Order): FunctionResponse => {
  const order = context.payload.data;

  // Validate, then return an error response the platform can log.
  if (!order.id) {
    const message = 'Order ID is missing from the payload';
    return { success: false, status: 400, message, error: { message } };
  }

  // ...your logic here (call an API, enqueue a job, enrich the order, …).

  return {
    success: true,
    status: 200,
    message: `Order ${order.reference_id} received`,
    data: { orderId: order.id, itemCount: order.items.length }
  };
};
```

Types come from `@salla.sa/app-functions-types` — a **types-only** package (no
runtime code). You author against those shapes; Salla injects the real SDK at
deploy time.

## Getting started

This starter Kit is designed to be used with the [Salla CLI](https://www.npmjs.com/package/@salla.sa/cli).
Every command for this starter Kit is run through the CLI as
**`salla app-functions <command>`**.

Installing dependencies automatically installs the CLI globally — the
`postinstall` hook runs `npm install -g @salla.sa/cli`, so it fires no matter
which package manager you use:

```bash
pnpm install     # (or npm install / yarn install)
                 # → runs postinstall → globally installs @salla.sa/cli
```

Once the CLI is on your `PATH`, build, deploy, and monitor through it:

```bash
salla app-functions build              # build the code into a dist file
salla app-functions deploy <app-id>    # deploy the dist file to the given app
salla app-functions listen <app-id>    # stream live logs from the app functions
```

`deploy` runs the build for you, so `salla app-functions deploy <app-id>` works
on its own. It's still worth running `salla app-functions build` (and
`npm run typecheck`) first, though — building locally surfaces type and compile
errors up front, so you catch them before shipping rather than mid-deploy.

> The exact CLI commands may evolve — run `salla app-functions --help` for the
> current list.

## Project structure

```
src/
  index.ts              # the events map (your default export)
  functions/            # one file per event handler
    order-created.ts
    customer-login.ts
test/
  index.spec.ts         # example tests for the handlers
```

## Scripts

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm test`           | Run the test suite once (Vitest)              |
| `npm run test:watch` | Run tests in watch mode                       |
| `npm run typecheck`  | Type-check without emitting (`tsc --noEmit`)  |
| `npm run lint`       | Lint with ESLint                              |
| `npm run format`     | Format with Prettier                          |

## Building your own

1. Add or rename handlers under `src/functions/`.
2. Register them in the `events` map in `src/index.ts`.
3. Update `test/index.spec.ts` to cover your handlers.
4. Build with `salla app-functions build` (and `npm run typecheck`) to catch
   type and compile errors locally.
5. Deploy with `salla app-functions deploy <app-id>` — it also builds as part of
   the deploy, so building first is about catching errors early, not a hard
   requirement.
6. Watch it run live with `salla app-functions listen <app-id>`.

## License

[MIT](LICENSE) © Salla
