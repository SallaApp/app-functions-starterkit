import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

/**
 * Builds a failed `FunctionResponse`. The envelope carries the same text twice —
 * once as `message`, once inside `error` — so this keeps the two from drifting.
 */
const failed = (status: number, message: string): FunctionResponse => ({
  success: false,
  status,
  message,
  error: { message }
});

/**
 * Handler for the `custom.event.authorize-user` event.
 *
 * Protected function: the platform forwards the caller's credential on
 * `context.authorization`, and this handler verifies it before doing any work.
 */
export const customEventAuthorizeUser = async (
  context: SallaCustomEvent
): Promise<FunctionResponse> => {
  // Mock verification API, replace with your own.
  const VERIFY_URL = 'https://example.com/verify-token';

  const { authorization } = context;
  const token = authorization?.token;

  if (!authorization?.is_protected_function || !token) {
    return failed(401, 'Unauthorized');
  }

  let verifiedClaims;
  try {
    const response = await fetch(VERIFY_URL, {
      headers: { Authorization: token }
    });

    if (!response.ok) {
      return failed(401, 'Invalid authorization token');
    }

    verifiedClaims = await response.json();
  } catch {
    return failed(401, 'Could not verify the authorization token');
  }

  return {
    success: true,
    status: 200,
    message: `User token verified successfully.`,
    data: verifiedClaims
  };
};
