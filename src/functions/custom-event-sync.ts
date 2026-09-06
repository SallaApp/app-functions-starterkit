import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

/**
 * Handler for the `custom.event.sync` event.
 *
 * Public function: no authorization check, so the endpoint is open. For the
 * protected variant see `custom-event-authorize-user.ts`.
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
