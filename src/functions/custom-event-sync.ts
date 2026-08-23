import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

/**
 * Handler for the `custom.event.sync` event.
 *
 * ⚠️ This is a **public function**: it performs no authorization check, so the
 * endpoint is open — anyone who knows the URL can invoke it, and the body it
 * receives is entirely attacker-controlled. That is fine for genuinely public
 * work (a health check, a webhook you re-verify yourself, a cache warm-up), but
 * never read a caller's identity from the payload and never let this handler
 * touch merchant data on the caller's behalf.
 *
 * If the function needs a caller to prove who they are, deploy it as a
 * protected function and check `context.authorization` instead — see
 * `custom-event-authorize-user.ts` for that variant.
 *
 * Every handler follows the same contract: it receives the typed event
 * `context` (the custom event lives at `context.payload.data`) and returns a
 * `FunctionResponse` — either a success or an error. Handlers may also be
 * `async` and return a `Promise<FunctionResponse>`.
 */
export const customEventSync = (context: SallaCustomEvent): FunctionResponse => {
  const eventData = context.payload.data;

  console.log(`Custom event received with data: ${JSON.stringify(eventData)}`);

  // Do your work here — call an API, enqueue a job, enrich the order, …

  return {
    success: true,
    status: 200,
    message: `Custom event invoked successfully.`,
    data: { foo: 'bar' }
  };
};
