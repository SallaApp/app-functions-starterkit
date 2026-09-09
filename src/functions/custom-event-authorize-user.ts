import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

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

  // fetch has no default timeout, so a verifier that accepts the connection
  // then goes quiet would hold the invocation until the platform kills it.
  const VERIFY_TIMEOUT_MS = 5_000;

  // Builds a failed response. The envelope carries the same text twice — once
  // as `message`, once inside `error` — so this keeps the two from drifting.
  const failed = (status: number, message: string): FunctionResponse => ({
    success: false,
    status,
    message,
    error: { message }
  });

  const { authorization } = context;
  const token = authorization?.token;

  if (!token) {
    return failed(401, 'Unauthorized');
  }

  let verifiedClaims: { active?: unknown };
  try {
    const response = await fetch(VERIFY_URL, {
      // Only ever send the credential to VERIFY_URL — following a redirect
      // would hand it to a host that was never vetted.
      redirect: 'error',
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      headers: { Authorization: token }
    });

    if (!response.ok) {
      return failed(401, 'Invalid authorization token');
    }

    verifiedClaims = await response.json();
  } catch {
    return failed(401, 'Could not verify the authorization token');
  }

  // A 2xx is not the answer, the body is: an introspection endpoint replies
  // 200 `{"active": false}` for an expired or revoked token.
  if (verifiedClaims?.active !== true) {
    return failed(401, 'Invalid authorization token');
  }

  return {
    success: true,
    status: 200,
    message: `User token verified successfully.`,
    data: verifiedClaims
  };
};
