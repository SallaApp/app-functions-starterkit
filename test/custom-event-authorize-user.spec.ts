import type { SallaCustomEvent } from '@salla.sa/app-functions-types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { customEventAuthorizeUser } from '../src/functions/custom-event-authorize-user';

/*
 * The protected custom event template is the one handler here where a mistake
 * is a security bug rather than a wrong response, so it gets its own suite.
 *
 * Everything it decides depends on a network call, so each test stubs `fetch`
 * and asserts on the envelope. Note the checks that `fetch` was *not* called:
 * for a rejected verifier URL the point isn't only that the caller gets an
 * error, it's that the credential never left the process.
 */

/** Builds a protected custom event context. Both halves are overridable so a
 *  test can drop the token, the settings, or — by passing `null` — the whole
 *  authorization block the platform would normally attach. */
const ctx = (
  settings: Record<string, unknown>,
  authorization: SallaCustomEvent['authorization'] | null = {
    is_protected_function: true,
    token: 'Bearer good',
    scheme: 'Bearer'
  }
): SallaCustomEvent =>
  ({
    payload: {
      event: 'custom.event.authorize.user',
      created_at: '2026-01-01T00:00:00Z',
      merchant: 1234,
      data: { hello: 'world' }
    },
    merchant: { id: 1234 },
    settings,
    authorization: authorization ?? undefined
  }) as SallaCustomEvent;

/** A verifier URL whose host is in the handler's allowlist. */
const ALLOWED = { verify_url: 'https://auth.example.com/introspect' };

/** Stubs `fetch` and hands back the spy so a test can assert it never ran. */
const stubFetch = (json: unknown, init: { ok?: boolean; status?: number } = {}) => {
  const spy = vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => {
      if (json instanceof Error) throw json;
      return json;
    }
  }));
  vi.stubGlobal('fetch', spy);
  return spy;
};

afterEach(() => vi.unstubAllGlobals());

describe('custom.event.authorize.user — reading the verifier’s answer', () => {
  test('runs the work only when the verifier says the token is active', async () => {
    stubFetch({ active: true });
    const res = await customEventAuthorizeUser(ctx(ALLOWED));
    expect(res).toMatchObject({ success: true, status: 200, data: { foo: 'bar' } });
  });

  test('rejects `200 {"active": false}` — a healthy verifier still saying no', async () => {
    // The trap this guards: an expired or revoked token gets a 2xx from an
    // introspection endpoint, so a status-only check would wave it through.
    stubFetch({ active: false });
    const res = await customEventAuthorizeUser(ctx(ALLOWED));
    expect(res).toMatchObject({ success: false, status: 401 });
  });

  test('rejects a 2xx whose body never asserts the token is active', async () => {
    stubFetch({ message: 'ok' });
    expect(await customEventAuthorizeUser(ctx(ALLOWED))).toMatchObject({ success: false });
  });

  test('fails closed on a non-2xx verifier response', async () => {
    stubFetch({}, { ok: false, status: 500 });
    expect(await customEventAuthorizeUser(ctx(ALLOWED))).toMatchObject({
      success: false,
      status: 401
    });
  });

  test('fails closed when the verifier body cannot be read', async () => {
    stubFetch(new Error('not json'));
    expect(await customEventAuthorizeUser(ctx(ALLOWED))).toMatchObject({ success: false });
  });
});

describe('custom.event.authorize.user — where the credential may be sent', () => {
  test.each([
    ['a host outside the allowlist', 'https://evil.example.net/introspect'],
    ['a link-local address', 'http://169.254.169.254/latest/meta-data/'],
    ['plaintext http', 'http://auth.example.com/introspect'],
    ['credentials embedded in the url', 'https://u:p@auth.example.com/introspect'],
    ['something that is not a url at all', 'definitely-not-a-url']
  ])('refuses %s without ever sending the token', async (_case, verify_url) => {
    const spy = stubFetch({ active: true });

    const res = await customEventAuthorizeUser(ctx({ verify_url }));

    expect(res).toMatchObject({ success: false, status: 500 });
    // The credential never left the process.
    expect(spy).not.toHaveBeenCalled();
  });

  test('refuses a missing `verify_url` setting', async () => {
    const spy = stubFetch({ active: true });
    expect(await customEventAuthorizeUser(ctx({}))).toMatchObject({ success: false, status: 500 });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('custom.event.authorize.user — the authorization gate', () => {
  test('refuses a request the platform did not mark protected', async () => {
    const spy = stubFetch({ active: true });
    expect(await customEventAuthorizeUser(ctx(ALLOWED, null))).toMatchObject({
      success: false,
      status: 401
    });
    expect(spy).not.toHaveBeenCalled();
  });

  test('refuses a protected request that carried no token', async () => {
    const spy = stubFetch({ active: true });
    const res = await customEventAuthorizeUser(ctx(ALLOWED, { is_protected_function: true }));
    expect(res).toMatchObject({ success: false, status: 401 });
    expect(spy).not.toHaveBeenCalled();
  });

  test('forwards the caller’s credential unchanged, and logs no secret', async () => {
    const spy = stubFetch({ active: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await customEventAuthorizeUser(ctx(ALLOWED));

    const [, init] = spy.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer good');
    expect([...warn.mock.calls, ...error.mock.calls].flat().join(' ')).not.toContain('Bearer good');

    warn.mockRestore();
    error.mockRestore();
  });
});
