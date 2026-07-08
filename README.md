# Salla App Functions — Template

> **This is a template repository.** It's a starting point for building a Salla
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
import { orderCreated } from './functions/order-created';
import type { Events } from './types';

const events = {
  'order.created': orderCreated
} satisfies Events;

export default events;
```

```ts
// src/functions/order-created.ts
import type { FunctionResponse, Order } from '../types';

export const orderCreated = (context: Order): FunctionResponse => {
  const order = context.payload.data;

  if (order.items.length === 0) {
    return {
      success: false,
      status: 422,
      message: 'Order has no items',
      error: { message: 'Order has no items' }
    };
  }

  return {
    success: true,
    status: 200,
    message: `Order ${order.reference_id} received`,
    data: { orderId: order.id, itemCount: order.items.length }
  };
};
```

Types come from `@salla.sa/functions-types` — a **types-only** package (no
runtime code). You author against those shapes; Salla injects the real SDK at
deploy time.

## Getting started

This template is designed to be used with the Salla CLI. Install it once:

```bash
npm install -g @salla.sa/cli
```

Then scaffold, develop, and deploy through the CLI:

```bash
salla app-functions create      # scaffold a new project from this template
npm install                     # install dependencies
salla app-functions dev         # run locally against sample events
salla app-functions deploy      # build and ship to Salla
```

> The exact CLI commands may evolve — run `salla --help` for the current list.

## Project structure

```
src/
  index.ts              # the events map (your default export)
  functions/            # one file per event handler
    order-created.ts
    customer-login.ts
    product-created.ts
  types/                # App Function type definitions
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
4. Deploy with the CLI.

## License

[MIT](LICENSE) © Salla
