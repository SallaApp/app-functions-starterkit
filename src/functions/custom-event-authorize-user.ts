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
  // Mock verification API, replace with your own.
  const VERIFY_URL = 'https://example.com/verify-token';

  const { authorization } = context;
  const token = authorization?.token;

  const baseErrorResponse = {
    success: false,
    status: 401
  };

  if (!authorization?.is_protected_function || !token) {
    return {
      ...baseErrorResponse,
      message: 'Unauthorized',
      error: { message: 'Unauthorized' }
    };
  }

  let verifiedClaims;
  try {
    const response = await fetch(VERIFY_URL, {
      headers: { Authorization: token }
    });

    if (!response.ok) {
      return {
        ...baseErrorResponse,
        message: 'Invalid authorization token',
        error: { message: 'Invalid authorization token' }
      };
    }

    verifiedClaims = await response.json();
  } catch {
    return {
      ...baseErrorResponse,
      message: 'Could not verify the authorization token',
      error: { message: 'Could not verify the authorization token' }
    };
  }

  return {
    success: true,
    status: 200,
    message: `User token verified successfully.`,
    data: verifiedClaims
  };
};
