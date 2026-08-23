import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

/**
 * Handler for the `custom.event.authorize.user` event.
 *
 * Protected function: the platform forwards the caller's credential on
 * `context.authorization`, and this handler verifies it before doing any work.
 */
export const customEventAuthorizeUser = async (
  context: SallaCustomEvent
): Promise<FunctionResponse> => {
  // Mock verification API — replace with your own.
  const VERIFY_URL = 'https://mock_url.com/verify-token';

  const unAuthorized = (message: string): FunctionResponse => ({
    success: false,
    status: 401,
    message,
    error: { message }
  });

  const { authorization } = context;

  if (!authorization?.is_protected_function || !authorization.token) {
    return unAuthorized('Unauthorized');
  }

  const verification = await fetch(VERIFY_URL, {
    headers: { Authorization: authorization.token }
  });

  if (!verification.ok) {
    return unAuthorized('Invalid authorization token');
  }

  const eventData = context.payload.data;

  console.log(`Custom event received with data: ${JSON.stringify(eventData)}`);

  return {
    success: true,
    status: 200,
    message: `Custom event invoked successfully.`,
    data: { foo: 'bar' }
  };
};
