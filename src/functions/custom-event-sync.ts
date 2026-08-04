import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

/**
 * Handler for the `custom.event.sync` event.
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
