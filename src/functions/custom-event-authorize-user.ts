import type { FunctionResponse, SallaCustomEvent } from '@salla.sa/app-functions-types';

/** Shorthand for the error half of the envelope — the same `message` both places. */
const fail = (status: number, message: string): FunctionResponse => ({
  success: false,
  status,
  message,
  error: { message }
});

/**
 * The only hosts this function will ever send the caller's credential to.
 *
 * **Replace these with your own and keep the list here, in code.** The URL
 * itself comes from `context.settings` so each merchant can point at their own
 * tenant or path — but a merchant-supplied value must never be the thing that
 * decides *who gets the credential*. If it were, a mistyped or tampered setting
 * would be enough to hand every caller's token to an attacker's server, or to
 * turn this function into a probe against internal addresses it can reach.
 * Pinning the host in code keeps that decision yours.
 */
const ALLOWED_VERIFIER_HOSTS = ['auth.example.com'];

/**
 * Turns the merchant-supplied setting into a URL that is safe to send a
 * credential to, or `null` if it isn't one.
 *
 * Requires HTTPS (a credential must never travel in plaintext), rejects
 * user:password embedded in the URL, and demands the host be one you listed
 * above.
 */
const resolveVerifierUrl = (raw: unknown): URL | null => {
  if (typeof raw !== 'string' || !raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!ALLOWED_VERIFIER_HOSTS.includes(url.hostname)) return null;

  return url;
};

/** RFC 7662 introspection answers `{"active": true}` for a usable credential. */
const isActive = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && (body as { active?: unknown }).active === true;

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
const verifyCaller = async (verifyUrl: URL, token: string): Promise<FunctionResponse | null> => {
  let body: unknown;

  try {
    // Pass the credential through untouched — `token` already carries its
    // scheme, so it goes on the wire exactly as the caller sent it.
    //
    // `redirect: 'error'` matters as much as the allowlist above: only the
    // *initial* URL is checked, so following a redirect would let an approved
    // verifier hand the request — and the answer we trust — to a host that was
    // never approved. A `{"active": true}` from a redirect target would then
    // authorize any token at all. A verifier that redirects is a
    // misconfiguration, so treat it as a failure rather than chase it.
    const verification = await fetch(verifyUrl, {
      method: 'GET',
      redirect: 'error',
      headers: { Authorization: token, Accept: 'application/json' }
    });

    if (!verification.ok) {
      // Log the outcome, never the credential itself.
      console.warn(`Verifier rejected the token (HTTP ${verification.status})`);
      return fail(401, 'Invalid authorization token');
    }

    body = await verification.json();
  } catch (error) {
    // A verifier that is down or answers with something unreadable must fail
    // closed — treat it as "not authorized" rather than letting the caller in.
    console.error('Could not verify the authorization token', error);
    return fail(503, 'Could not verify the authorization token');
  }

  // A 2xx is *not* proof the credential is good. An introspection endpoint
  // answers `200 {"active": false}` for a token that is expired, revoked or
  // simply unknown, so a status-only check would wave those straight through.
  // Demand an explicit yes; anything else is a no.
  if (!isActive(body)) {
    console.warn('Verifier reported the token as inactive');
    return fail(401, 'Invalid authorization token');
  }

  return null;
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
 * token in the first place. Only if that endpoint gives an explicit yes do we
 * run the same body as the public `custom.event.sync` example.
 *
 * Two things this template is deliberate about, because sending someone's
 * credential somewhere is easy to get wrong:
 *   • it only ever sends the token to a host listed in
 *     `ALLOWED_VERIFIER_HOSTS` below — edit that list before you deploy;
 *   • it reads the verifier's *answer*, not just its HTTP status, since a
 *     healthy endpoint returns `200` while saying the token is invalid.
 *
 * The suffix after `custom.event.` is entirely yours to pick, so a handler like
 * this needs no registration beyond the entry in `src/index.ts`.
 *
 * Because the verification is a network call, this handler is `async` and
 * returns a `Promise<FunctionResponse>` — the platform awaits it either way.
 */
export const customEventAuthorizeUser = async (
  context: SallaCustomEvent
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

  // Which endpoint vouches for the credential is per-merchant, read from the
  // app's settings form — but only after it has been checked against the hosts
  // allowed above, so a bad setting can't redirect the token somewhere else.
  const verifyUrl = resolveVerifierUrl(context.settings?.verify_url);

  if (!verifyUrl) {
    console.error('`verify_url` is missing, not HTTPS, or not an allowed verifier host');
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
