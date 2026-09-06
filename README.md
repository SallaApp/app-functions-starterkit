<div align="center">

# Salla App Functions — Starter Kit

**Run your code inside a merchant's store, without running a server.**

A ready-to-ship TypeScript project for building a Salla [App Function](https://docs.salla.dev/1726814m0):
typed event handlers that Salla executes for you when something happens in a store.

[![Salla CLI](https://img.shields.io/npm/v/@salla.sa/cli?label=%40salla.sa%2Fcli&color=004956)](https://www.npmjs.com/package/@salla.sa/cli)
[![Types](https://img.shields.io/npm/v/@salla.sa/app-functions-types?label=app-functions-types&color=004956)](https://www.npmjs.com/package/@salla.sa/app-functions-types)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.12-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[**What are App Functions?**](https://docs.salla.dev/1726814m0) ·
[**Quick Start**](https://docs.salla.dev/1726815m0) ·
[**Supported Events**](https://docs.salla.dev/1726818m0) ·
[**Testing**](https://docs.salla.dev/1726816m0) ·
[**Partner Portal**](https://salla.partners/)

</div>

---

> [!NOTE]
> **This is a starter kit, not a finished app.** Clone or scaffold from it with the
> [Salla CLI](https://www.npmjs.com/package/@salla.sa/cli), replace the example handlers
> with your own, and ship. The two handlers in [src/functions/](src/functions/) are
> reference material — delete them once you have your own.

## Table of contents

- [What is an App Function?](#what-is-an-app-function)
- [Quick start](#quick-start)
- [The contract](#the-contract)
- [Project structure](#project-structure)
- [Event reference](#event-reference)
- [Custom events](#custom-events)
  - [Public and protected custom events](#public-and-protected-custom-events)
- [Response envelope](#response-envelope)
- [Calling Salla APIs](#calling-salla-apis)
- [Testing](#testing)
- [Deploying and watching logs](#deploying-and-watching-logs)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

## What is an App Function?

An App Function lets your Partner app react to activity inside a merchant's store — an order
is created, a customer signs in, a shipment is about to be made. You write a small typed
handler; Salla runs it on its own infrastructure when the event fires. There is no server to
provision, no endpoint to expose, and no webhook signature to verify.

Compared with [classic webhooks](https://docs.salla.dev/421119m0), you skip the hosting,
the retry handling, and the request authentication — Salla API calls from inside a function
are already authenticated.

### Two execution models

Which one you get is decided by the event, not by your code.

|                          | **Asynchronous events**                          | **Synchronous actions**                           |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| **Example**              | `order.created`                                  | `shipment.creating`                               |
| **When it runs**         | In the background, after the operation completes | Inline, _before_ the operation completes          |
| **Is the user waiting?** | No                                               | **Yes — the storefront/dashboard is blocked**     |
| **Time budget**          | Up to 30s                                        | Respond in milliseconds (**< 500ms** recommended) |
| **Use it for**           | Syncing, notifications, analytics, enrichment    | Validation, or modifying the operation            |

> [!WARNING]
> In a **synchronous** action a real person is staring at a spinner. Avoid slow external
> API calls, heavy computation, and sequential round-trips. Everything storefront
> customers trigger is asynchronous; today `shipment.creating` is the only synchronous
> event ([shipment schemas](https://docs.salla.dev/1726835m0)).

App Functions are **free while in beta**. Future pricing will be based on call count,
execution time, and resources — see [the overview](https://docs.salla.dev/1726817m0).

## Quick start

### 1. Prerequisites

- **Node.js ≥ 22.12** — the Salla CLI requires it (this project's own floor is 20.19).
- A [Salla Partner account](https://salla.partners/).
- **A Partner app** — App Functions always run on behalf of an app, so you need one before
  anything else here works. Create it either way:
  - **Partner Portal** — [salla.partners](https://salla.partners/) → _My Apps_ → _Create App_.
  - **CLI** — `salla app create` walks you through the same thing from the terminal
    (install the CLI and run `salla login` first — see [Install](#2-install) below).
- A [demo store](https://salla.dev/blog/how-to-test-your-app-using-salla-demo-stores/) with
  your app installed.
- The **app scopes** your events need (e.g. `orders.read`), enabled on the app.

### 2. Install

```bash
pnpm install        # or npm install / yarn install
npm install -g @salla.sa/cli
salla login
```

The CLI is a global binary — installing it globally is what puts `salla` on your `PATH`.

### 3. Point the project at your app

Copy the example env file and fill in your app ID, so you don't have to pass it on every
command:

```bash
cp .env.example .env
```

```bash
# .env
SALLA_APP_ID=1234567890                 # from the portal, or `salla app list`
```

`.env` is gitignored and configures **the CLI on your machine** — it is not shipped to the
deployed function. Per-merchant secrets belong in your app's settings form, which reaches
your handler as [`context.settings`](#the-context-object).

### 4. Build, deploy, observe

```bash
salla app functions build              # bundle src/index.ts -> dist/index.js
salla app functions deploy             # build + ship it (prints a preview URL)
salla app functions serve              # stream live logs from your function
```

`deploy` builds for you, so it works standalone — but running `build` and
`npm run typecheck` first surfaces type and compile errors locally instead of mid-deploy.

## The contract

Your project exports **one `events` map** from [src/index.ts](src/index.ts). That's the whole
interface between your code and the platform — the CLI will refuse to build without it:

> `An App Function project must export an "events" map from src/index.ts.`

```ts
// src/index.ts
import type { DefineEvents } from '@salla.sa/app-functions-types';
import { orderCreated } from './functions/order-created';

// The types package ships no runtime code, so provide the identity implementation
// and borrow its `DefineEvents` signature for compile-time key validation.
const defineEvents: DefineEvents = (events) => events;

const events = defineEvents({
  'order.created': orderCreated
});

export default events;
```

`defineEvents` is a **type-level guard**: an event name that Salla doesn't recognise
collapses the map's type to `never`, so `npm run typecheck` fails on a typo before you ever
deploy it.

Each handler takes a typed `context` and returns a `FunctionResponse`. Handlers may be
`async` and return `Promise<FunctionResponse>`.

```ts
// src/functions/order-created.ts
import type { FunctionResponse, Order } from '@salla.sa/app-functions-types';

export const orderCreated = (context: Order): FunctionResponse => {
  const order = context.payload.data;

  // Validate first, and return an error response the platform can log.
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

### The context object

Every handler receives the same three-part shape:

```ts
const { payload, merchant, settings } = context;
```

| Field                | What's in it                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `payload.event`      | The event name that fired                                                                                                                     |
| `payload.data`       | The event-specific record — the order, the customer, …                                                                                        |
| `payload.merchant`   | Merchant (store) ID                                                                                                                           |
| `payload.created_at` | ISO timestamp of the event                                                                                                                    |
| `merchant`           | Merchant details (`{ id, … }`)                                                                                                                |
| `settings`           | Your app's [settings](https://salla.dev/blog/how-to-build-app-settings-form/) for _this_ merchant — put API keys and URLs here, never in code |

Types come from [`@salla.sa/app-functions-types`](https://www.npmjs.com/package/@salla.sa/app-functions-types),
a **types-only** package (zero runtime code) kept as a `devDependency`. You author against
its shapes; Salla injects the real SDK at deploy time.

## Project structure

```
src/
  index.ts                # the events map — your default export
  functions/              # one file per handler
    order-created.ts
    customer-login.ts
test/
  index.spec.ts           # example tests for the handlers
dist/
  index.js                # build output (generated; deployed artifact)
.env.example              # template for CLI config — copy to .env
```

## Event reference

Event names are **exact string literals** in `dot.case` trigger format — `order.created`,
`customer.login`, `product.viewed`, `signed.in`. This is true for every event, whatever its
origin; the platform normalises all triggers to this form, so there is no `Title Case`
variant to remember:

- **Merchant / backend events** fire from the dashboard and the API — `order.created`
- **Storefront (customer) events** fire from the shopper's browser — `product.viewed`

The lists below are the platform's trigger names, grouped by the category the platform
assigns them. Each row links to that category's payload schema.

<details open>
<summary><b>Merchant events</b> — <code>dot.case</code>, all async unless flagged</summary>

<br>

| Category           | Event names                                                                                                                                                                                                                                                                                   | Schema                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Orders**         | `order.created` · `order.updated` · `order.cancelled` · `order.refunded` · `order.deleted` · `order.status.updated` · `order.products.updated` · `order.payment.updated` · `order.coupon.updated` · `order.total.price.updated` · `order.shipping.address.updated` · `order.customer.updated` | [Order Events](https://docs.salla.dev/1894252m0)         |
| **Products**       | `product.created` · `product.updated` · `product.deleted` · `product.available` · `product.quantity.low`                                                                                                                                                                                      | [Events index](https://docs.salla.dev/1726818m0)         |
| **Customers**      | `customer.created` · `customer.updated` · `customer.login`                                                                                                                                                                                                                                    | [Customer Events](https://docs.salla.dev/1726829m0)      |
| **Shipments**      | ⚡ `shipment.creating` **(sync)** · `shipment.created` · `shipment.updated` · `shipment.cancelled`                                                                                                                                                                                            | [Shipment Events](https://docs.salla.dev/1726835m0)      |
| **Shipping zones** | `shipping.zone.created` · `shipping.zone.updated`                                                                                                                                                                                                                                             | [Shipping Zone Events](https://docs.salla.dev/1726826m0) |
| **Categories**     | `category.created` · `category.updated` · `category.deleted`                                                                                                                                                                                                                                  | [Category Events](https://docs.salla.dev/1726827m0)      |
| **Brands**         | `brand.created` · `brand.updated` · `brand.deleted`                                                                                                                                                                                                                                           | [Brand Events](https://docs.salla.dev/1726834m0)         |
| **Store**          | `store.branch.created` · `store.branch.updated` · `store.branch.setDefault` · `store.branch.activated` · `store.branch.deleted` · `storetax.created`                                                                                                                                          | [Store Branch Events](https://docs.salla.dev/1726831m0)  |
| **Cart**           | `abandoned.cart` · `abandoned.cart.update`                                                                                                                                                                                                                                                    | [Cart Events](https://docs.salla.dev/1726838m0)          |
| **Invoices**       | `invoice.created`                                                                                                                                                                                                                                                                             | [Invoice Events](https://docs.salla.dev/1726824m0)       |
| **Special offers** | `specialoffer.created` · `specialoffer.updated`                                                                                                                                                                                                                                               | [Special Offer Events](https://docs.salla.dev/1726828m0) |
| **Communication**  | `communication.sms.send` · `communication.email.send` · `communication.whatsapp.send`                                                                                                                                                                                                         | [Events index](https://docs.salla.dev/1726818m0)         |

</details>

<details>
<summary><b>Storefront events</b> — platform category <code>ecommerce_events</code>, always async</summary>

<br>

| Category                 | Event names                                                                                                                                                                               | Schema                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Products**             | `product.viewed` · `product.clicked` · `product.shared` · `product.reviewed` · `products.searched`                                                                                        | [Product Events](https://docs.salla.dev/1726820m0)            |
| **Product lists**        | `product.list.viewed` · `product.list.filtered` · `product.list.sorted`                                                                                                                   | [Product Events](https://docs.salla.dev/1726820m0)            |
| **Product details**      | `product.price.updated` · `product.status.updated` · `product.brand.updated` · `product.category.updated` · `product.image.updated` · `product.tags.updated` · `product.channels.changed` | [Product Events](https://docs.salla.dev/1726820m0)            |
| **Cart**                 | `cart.viewed` · `cart.updated` · `cart.shared` · `product.added` · `product.removed`                                                                                                      | [Cart & Checkout](https://docs.salla.dev/1726822m0)           |
| **Checkout**             | `checkout.started` · `checkout.step.viewed` · `checkout.step.completed`                                                                                                                   | [Cart & Checkout](https://docs.salla.dev/1726822m0)           |
| **Payment**              | `payment.info.entered` · `payment.submitted` · `payment.succeeded` · `payment.failed` · `payment.pending`                                                                                 | [Cart & Checkout](https://docs.salla.dev/1726822m0)           |
| **Orders**               | `order.completed` · `ecommerce.order.updated` · `ecommerce.order.cancelled` · `ecommerce.order.refunded`                                                                                  | [Cart & Checkout](https://docs.salla.dev/1726822m0)           |
| **Coupons & promotions** | `coupon.entered` · `coupon.applied` · `coupon.removed` · `coupon.denied` · `promotion.viewed` · `promotion.clicked`                                                                       | [Promotion & Coupon Events](https://docs.salla.dev/1726821m0) |
| **Wishlist**             | `product.added.to.wishlist` · `product.removed.from.wishlist` · `wishlist.product.added.to.cart`                                                                                          | [Wishlist Events](https://docs.salla.dev/1726823m0)           |
| **Account**              | `signed.in` · `signed.up` · `signed.out` · `user.profile.updated`                                                                                                                         | [Account Events](https://docs.salla.dev/1726819m0)            |
| **Address**              | `address.added` · `address.updated` · `map.clicked`                                                                                                                                       | [Cart & Checkout](https://docs.salla.dev/1726822m0)           |

</details>

> [!TIP]
> The storefront order events are prefixed — `ecommerce.order.updated`, `ecommerce.order.cancelled`
> and `ecommerce.order.refunded` — precisely because a merchant event of the same shape
> (`order.updated`, `order.cancelled`, `order.refunded`) already exists. They are **different
> events with different payloads**; the prefix is what keeps them apart.

> [!IMPORTANT]
> If the [docs](https://docs.salla.dev/1726818m0) and the types package disagree, the types
> package decides what compiles. A few documented events aren't in the type union yet
> (for example `shipping.company.*` and `review.added`), so they won't typecheck as map keys.

## Custom events

Beyond Salla's events you can define your own, namespaced under `custom.event.`:

```ts
const events = defineEvents({
  'custom.event.nightly-inventory-sync': nightlyInventorySync
});
```

The suffix is validated at compile time:

| Rule                                     | ✅                        | ❌                       |
| ---------------------------------------- | ------------------------- | ------------------------ |
| Lowercase `a–z`, `0–9`, `-` and `.` only | `custom.event.order-sync` | `custom.event.orderSync` |
| No leading or trailing hyphen            | `custom.event.sync-v2`    | `custom.event.-sync`     |
| No consecutive hyphens                   | `custom.event.sync-v2`    | `custom.event.sync--v2`  |
| Max 60 characters                        | —                         | a 61-char suffix         |

> [!WARNING]
> **The compiler is more permissive than the platform.** The type allows `.` in the suffix,
> but the deploy API rejects it — use hyphens only. `custom.event.authorize.user` type-checks
> and then fails at upload with:
>
> ```
> HTTP 400 — Invalid custom event name "custom.event.authorize.user" — expected the exact
> lowercase prefix "custom.event." followed by 1-60 characters of lowercase letters, numbers,
> and single hyphens
> ```
>
> Name it `custom.event.authorize-user` instead. `npm run typecheck` will not catch this.

Custom events have no prebuilt context type, so describe your own payload using the shared
building blocks the package exports:

```ts
import type {
  CustomEventPayload,
  EventSettings,
  FunctionResponse,
  Merchant
} from '@salla.sa/app-functions-types';

interface CustomEventContext<T extends CustomEventPayload> {
  payload: { event: string; created_at: string; merchant: number; data: T };
  merchant: Merchant;
  settings?: EventSettings;
}

type SyncPayload = { sku: string; quantity: number };

export const nightlyInventorySync = (
  context: CustomEventContext<SyncPayload>
): FunctionResponse => {
  const { sku, quantity } = context.payload.data;
  return { success: true, status: 200, data: { sku, quantity } };
};
```

### Public and protected custom events

A custom event is reachable over HTTP, so the first thing to decide is who may call it.
Both variants ship in `src/functions/`:

|                         | [custom-event-sync.ts](src/functions/custom-event-sync.ts) | [custom-event-authorize-user.ts](src/functions/custom-event-authorize-user.ts) |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Deployed as             | public                                                     | protected                                                                      |
| `context.authorization` | absent                                                     | populated by the platform                                                      |
| Who can invoke it       | anyone with the URL                                        | only a caller whose credential you verify                                      |

**Public** is the default. With no authorization check the endpoint is open — anyone who
knows the URL can invoke it, and the payload is entirely caller-controlled. That is fine for
genuinely public work, but never read a caller's identity out of the payload and never let a
public function act on merchant data on the caller's behalf.

**Protected** functions get an `authorization` block on the context. The caller puts a
credential in the authorization header, and the platform forwards it to you:

```ts
authorization?: {
  is_protected_function: boolean; // the function really is deployed as protected
  token?: string;                 // the raw credential, e.g. "Bearer xxxx"
  scheme?: string;                // its scheme, e.g. "Bearer"
}
```

> [!IMPORTANT]
> The platform **hands you** the credential; it does not validate it. Deciding whether the
> token is good is your job — a handler that only checks `is_protected_function` is still
> open to anyone who sends any header at all.

So verify it, by calling whatever API can vouch for it — your own auth service, an OAuth
introspection endpoint, whatever issued the token — passing the credential straight through:

```ts
const { authorization } = context;

if (!authorization?.is_protected_function || !authorization.token) {
  return { success: false, status: 401, message, error: { message } };
}

const verification = await fetch(VERIFY_URL, {
  redirect: 'error',
  signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
  headers: { Authorization: authorization.token }
});
```

The example keeps the verification deliberately minimal — it is a template, not a finished
auth integration. Before you rely on it, think about:

- **What counts as a yes.** The example treats any `2xx` as valid. Real introspection
  endpoints reply `200 {"active": false}` for an expired or revoked token, so if yours does,
  check the body rather than the status.
- **Where the token may travel.** `fetch` follows redirects by default, so an endpoint that
  redirects will hand your caller's credential to whatever host it points at.
- **How long you will wait.** `fetch` has no timeout. A verifier that accepts the connection
  and then stalls will hold the invocation until the platform kills it.

`VERIFY_URL` in the example points at `example.com`, which IANA reserves, so an unedited
deployment cannot send tokens to anyone's server. Replace it with your own before deploying.

## Response envelope

Every handler returns a `FunctionResponse<T>` — a discriminated union on `success`:

```ts
// Success
{ success: true,  data: T, status?: number, message?: string }

// Error
{ success: false, message: string, error: { message: string, fields?: Record<string, string[]> } }
```

`data` is required on success (pass `{}` if there's nothing to report) and `status` defaults
to `200`. Because it's a discriminated union, TypeScript only lets you read `data` after
you've narrowed with `if (response.success)`.

> [!NOTE]
> Functions authored **in the Partner Portal editor** use a `Resp` builder
> (`Resp.success().setData({})`) as shown in the [docs](https://docs.salla.dev/1726815m0).
> In a CLI project like this one you return the plain typed object above. Same envelope on
> the wire, two authoring styles.

## Calling Salla APIs

Requests to `https://api.salla.dev/admin/v2/` from inside a function are **authenticated
automatically** — don't add an `Authorization` header. Just make sure the app has the right
scope enabled in the portal.

```ts
const res = await fetch('https://api.salla.dev/admin/v2/orders/12345');
```

Full endpoint list: [Merchant API reference](https://docs.salla.dev/426392m0).

## Testing

Run the local suite ([Vitest](https://vitest.dev)):

```bash
npm test              # once
npm run test:watch    # watch mode
npm run typecheck     # tsc --noEmit
```

[test/index.spec.ts](test/index.spec.ts) exercises handlers the way the platform does — it
looks each one up in the exported `events` map and calls it with a context object. Real
payloads have dozens of fields your handler never reads, so it uses a small `fixture`
helper to keep test data minimal while still type-checking the fields you do set. Copy a
block, swap in your event, assert on the response.

Beyond unit tests, validate against a real store with the **preview panel** in the Partner
Portal — pick your demo store, supply an order/product/customer ID, and inspect the
response, console logs, and execution time. See the [testing guide](https://docs.salla.dev/1726816m0).

Good practice: cover the happy path _and_ malformed payloads, log flow without ever logging
secrets or payment data, and keep responses small.

## Deploying and watching logs

```bash
salla app functions build                 # bundle to dist/index.js
salla app functions deploy [app_id]       # build + upload, waits for status, prints preview URL
salla app functions serve  [app_id]       # stream live logs (console.log, errors, …)
```

| Flag / variable          | Effect                                                    |
| ------------------------ | --------------------------------------------------------- |
| `--app-id <id>`          | Target app, instead of the positional `app_id`            |
| `SALLA_APP_ID` in `.env` | Default app ID, so you can omit it entirely               |
| `deploy --skip-build`    | Upload the existing `dist/index.js` without rebuilding    |
| `serve --raw`            | Print full websocket envelopes instead of formatted lines |

Omit the app ID entirely and the CLI will ask you to pick from your apps. Changes stay in
the sandbox until you **publish** from the portal; once published, merchants with your app
installed get them automatically.

> Command surface may evolve — run `salla app functions --help` for the current list.

## Scripts

| Command              | What it does                                 |
| -------------------- | -------------------------------------------- |
| `npm test`           | Run the test suite once (Vitest)             |
| `npm run test:watch` | Run tests in watch mode                      |
| `npm run typecheck`  | Type-check without emitting (`tsc --noEmit`) |
| `npm run lint`       | Lint with ESLint                             |
| `npm run format`     | Format with Prettier                         |

Build and deploy go through the CLI, not npm scripts.

## Troubleshooting

| Symptom                                                                   | Likely cause                                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Argument of type '{ … }' is not assignable to parameter of type 'never'` | An event key isn't recognised — check exact spelling; keys are lowercase `dot.case` triggers (`product.viewed`, not `"Product Viewed"`) |
| `No src/index.ts found`                                                   | Running the CLI outside the project root, or the `events` map isn't the default export                                                  |
| `No app_id found`                                                         | Pass `app_id` / `--app-id`, or set `SALLA_APP_ID` in `.env`                                                                             |
| `No dist/index.js found`                                                  | You used `--skip-build` before ever building — run `salla app functions build`                                                          |
| Function times out                                                        | Async budget is 30s, sync is sub-second — add fetch timeouts and drop sequential calls                                                  |
| `context` fields are `undefined`                                          | Wrong event type selected, or the test record doesn't exist in the demo store                                                           |
| Salla API call returns 401/403                                            | The app is missing the scope that endpoint needs                                                                                        |

## Building your own

1. Add or rename handlers under [src/functions/](src/functions/).
2. Register them in the `events` map in [src/index.ts](src/index.ts).
3. Cover them in [test/index.spec.ts](test/index.spec.ts).
4. `npm run typecheck && npm test`, then `salla app functions build`.
5. `salla app functions deploy` and open the preview URL.
6. `salla app functions serve` to watch it run for real.
7. Publish from the [Partner Portal](https://salla.partners/) when you're happy.

## Support

- 📚 [App Functions documentation](https://docs.salla.dev/1726817m0)
- 🐛 [Report a CLI bug](https://github.com/SallaApp/Salla-CLI/issues/new)
- 💬 [Salla developer community on Telegram](https://t.me/salladev)

## License

[MIT](LICENSE) © Salla
