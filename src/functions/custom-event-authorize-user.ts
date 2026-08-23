import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

/**
 * The authorization block the platform forwards for a protected custom event.
 *
 * TODO(PO-3064): delete this local declaration and read the types straight from
 * `@salla.sa/app-functions-types` once the package publishes a version that
 * includes them (https://github.com/SallaApp/app-functions-types/pull/21).
 * The installed 0.5.0 doesn't have them yet, so `context.authorization` would
 * not compile without this. The shape below matches the PR exactly, so the
 * intersection keeps compiling after the bump — then it can just go away.
 *
 * Note: more keys may be added to this object later, so treat it as extensible
 * and only rely on the keys you explicitly handle.
 */
interface CustomEventAuthorization {
  /**
   * `true` when the function is deployed as a protected function, meaning the
   * caller is expected to send a credential that your function must verify.
   * `false` (or a missing `authorization` object) means the endpoint is public.
   */
  is_protected_function: boolean;
  /** The raw credential sent by the caller, e.g. `"Bearer xxxx"`. */
  token?: string;
  /** The authorization scheme of the credential, e.g. `"Bearer"`. */
  scheme?: string;
}

type ProtectedCustomEvent<T = unknown> = SallaCustomEvent<T> & {
  authorization?: CustomEventAuthorization;
};

/** Shorthand for the error half of the envelope — the same `message` both places. */
const fail = (status: number, message: string): FunctionResponse => ({
  success: false,
  status,
  message,
  error: { message }
});

/**
 * Passes the caller's credential through to a verification endpoint and reports
 * whether it checked out. Returns `null` when the credential is good, or the
 * error response to send back when it isn't.
 *
 * `verifyUrl` is whichever endpoint can vouch for the credential — your own
 * auth service, an OAuth introspection endpoint, whatever issued the token.
 * Note it is *your* API, not Salla's: calls to `api.salla.dev` are authenticated
 * for you and must not carry an `Authorization` header.
 */
const verifyCaller = async (verifyUrl: string, token: string): Promise<FunctionResponse | null> => {
  try {
    // Pass the credential through untouched — `token` already carries its
    // scheme, so it goes on the wire exactly as the caller sent it.
    const verification = await fetch(verifyUrl, {
      method: 'GET',
      headers: { Authorization: token, Accept: 'application/json' }
    });

    if (!verification.ok) {
      // Log the outcome, never the credential itself.
      console.warn(`Authorization token rejected by ${verifyUrl} (HTTP ${verification.status})`);
      return fail(401, 'Invalid authorization token');
    }

    return null;
  } catch (error) {
    // A verification service that is down must fail closed — treat it as "not
    // authorized" rather than letting the request through.
    console.error('Could not verify the authorization token', error);
    return fail(503, 'Could not verify the authorization token');
  }
};

/**
 * Handler for the `custom.event.authorize.user` event.
 *
 * 🔒 This is a **protected function**: it refuses to do any work until it has
 * verified the caller. Deploy it as protected in the Partner Portal, and the
 * platform will forward whatever credential the caller put in the custom
 * authorization header on `context.authorization` — `is_protected_function`
 * tells you the function really is protected, `token` is the raw credential
 * (e.g. `"Bearer xxxx"`) and `scheme` its scheme (e.g. `"Bearer"`).
 *
 * The platform hands you the credential; it does **not** validate it for you.
 * Deciding whether that credential is good is yours to do, so this example
 * passes it straight through to a verification endpoint of your choosing —
 * your own auth service, an OAuth introspection endpoint, whatever issued the
 * token in the first place. Only if that call says the credential is valid do
 * we run the same body as the public `custom.event.sync` example.
 *
 * The suffix after `custom.event.` is entirely yours to pick, so a handler like
 * this needs no registration beyond the entry in `src/index.ts`.
 *
 * Because the verification is a network call, this handler is `async` and
 * returns a `Promise<FunctionResponse>` — the platform awaits it either way.
 */
export const customEventAuthorizeUser = async (
  context: ProtectedCustomEvent
): Promise<FunctionResponse> => {
  const { authorization } = context;

  // The function was invoked without the platform marking it protected. Bail
  // out rather than silently serving an open endpoint.
  if (!authorization?.is_protected_function) {
    console.error('Expected a protected function, but the request carried no authorization');
    return fail(401, 'Unauthorized');
  }

  // Protected, but the caller sent no credential in the authorization header.
  if (!authorization.token) {
    console.error('Missing authorization token');
    return fail(401, 'Missing authorization token');
  }

  // Point this at whichever endpoint can vouch for the credential. It's read
  // from `context.settings` — the app's settings form — so each merchant can
  // supply their own, and no URL or secret is ever hardcoded here.
  const verifyUrl = context.settings?.verify_url;

  if (typeof verifyUrl !== 'string' || !verifyUrl) {
    console.error('No `verify_url` configured in the app settings');
    return fail(500, 'Authorization is not configured for this app');
  }

  const rejected = await verifyCaller(verifyUrl, authorization.token);
  if (rejected) return rejected;

  // ── Verified. From here on it's the same body as the public example. ──

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
