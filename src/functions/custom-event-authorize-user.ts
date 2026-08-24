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
  // Mock verification API — replace with your own. example.com is reserved by
  // IANA, so an unchanged deployment can never send tokens to someone's server.
  const VERIFY_URL = 'https://example.com/verify-token';

  // How long to wait on the verifier before giving up. Keep it well inside the
  // platform's execution budget so the handler answers rather than being killed.
  const VERIFY_TIMEOUT_MS = 5_000;

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

  let result: { active?: unknown };

  // A verifier that is unreachable, redirects, stalls, or answers with
  // something unreadable must fail closed — never let the rejection escape the
  // handler.
  try {
    const verification = await fetch(VERIFY_URL, {
      // Don't follow redirects: the token must only ever reach VERIFY_URL.
      redirect: 'error',
      // Without a deadline a verifier that accepts the connection and then goes
      // quiet leaves this awaiting until the platform kills the invocation —
      // burning the execution budget instead of returning 401. The signal
      // covers reading the body too, not just the response headers.
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      headers: { Authorization: authorization.token }
    });

    if (!verification.ok) {
      return unAuthorized('Invalid authorization token');
    }

    result = await verification.json();
  } catch {
    return unAuthorized('Could not verify the authorization token');
  }

  // A 2xx is not the answer — the body is. A verifier replies 200 with
  // `{"active": false}` for an expired or revoked token, so require a clear yes.
  if (result?.active !== true) {
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
