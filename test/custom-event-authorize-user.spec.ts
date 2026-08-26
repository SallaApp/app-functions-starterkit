import type { SallaCustomEvent } from '@salla.sa/app-functions-types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { customEventAuthorizeUser } from '../src/functions/custom-event-authorize-user';

/** Builds a protected custom event context. Pass `null` to drop the
 *  authorization block the platform would normally attach. */
const ctx = (
  authorization: SallaCustomEvent['authorization'] | null = {
    is_protected_function: true,
    token: 'Bearer good',
    scheme: 'Bearer'
  }
): SallaCustomEvent =>
  ({
    payload: {
      event: 'custom.event.authorize-user',
      created_at: '2026-01-01T00:00:00Z',
      merchant: 1234,
      data: { hello: 'world' }
    },
    merchant: { id: 1234 },
    settings: {},
    authorization: authorization ?? undefined
  }) as SallaCustomEvent;

/** Stubs `fetch` and hands back the spy so a test can assert it never ran.
 *  Pass an `Error` as `body` to make reading the response reject. */
const stubFetch = (ok: boolean, body: unknown = { active: true }, status = ok ? 200 : 401) => {
  const spy = vi.fn(async () => ({
    ok,
    status,
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    }
  }));
  vi.stubGlobal('fetch', spy);
  return spy;
};

/** Stubs a `fetch` that rejects outright — an unreachable verifier, or a
 *  redirect refused by `redirect: 'error'`. */
const stubFetchRejecting = () => {
  const spy = vi.fn(async () => {
    throw new TypeError('fetch failed');
  });
  vi.stubGlobal('fetch', spy);
  return spy;
};

afterEach(() => vi.unstubAllGlobals());

describe('custom.event.authorize-user', () => {
  test('refuses a request the platform did not mark protected', async () => {
    const fetchSpy = stubFetch(true);

    const response = await customEventAuthorizeUser(ctx(null));

    expect(response).toMatchObject({ success: false, status: 401 });
    // The credential never left the process.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('refuses a protected request that carried no token', async () => {
    const fetchSpy = stubFetch(true);

    const response = await customEventAuthorizeUser(ctx({ is_protected_function: true }));

    expect(response).toMatchObject({ success: false, status: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('forwards the caller’s credential unchanged and runs the work', async () => {
    const fetchSpy = stubFetch(true);

    const response = await customEventAuthorizeUser(ctx());

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/verify-token', {
      redirect: 'error',
      signal: expect.any(AbortSignal),
      headers: { Authorization: 'Bearer good' }
    });
    expect(response).toMatchObject({ success: true, status: 200 });
  });

  test('bounds the verifier call with a deadline', async () => {
    // Without this the handler would await a stalled verifier until the
    // platform killed the invocation, so pin the signal against a later edit.
    const fetchSpy = stubFetch(true);

    await customEventAuthorizeUser(ctx());

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test('fails closed when the verifier stalls past the deadline', async () => {
    // What the timeout produces at runtime: fetch rejects with a TimeoutError
    // rather than hanging, so the handler still returns an envelope.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      })
    );

    const response = await customEventAuthorizeUser(ctx());

    expect(response).toMatchObject({ success: false, status: 401 });
  });

  test('returns 401 when the verifier rejects the token', async () => {
    stubFetch(false);

    const response = await customEventAuthorizeUser(ctx());

    expect(response).toMatchObject({ success: false, status: 401 });
  });

  test('returns 401 on `200 {"active": false}` — a healthy verifier still saying no', async () => {
    stubFetch(true, { active: false });

    const response = await customEventAuthorizeUser(ctx());

    expect(response).toMatchObject({ success: false, status: 401 });
  });

  test('returns 401 when the body never asserts the token is active', async () => {
    stubFetch(true, {});

    const response = await customEventAuthorizeUser(ctx());

    expect(response).toMatchObject({ success: false, status: 401 });
  });

  test('fails closed when the verifier is unreachable or redirects', async () => {
    stubFetchRejecting();

    // The rejection must never escape — the runtime always gets an envelope.
    const response = await customEventAuthorizeUser(ctx());

    expect(response).toMatchObject({ success: false, status: 401 });
  });

  test('fails closed when the verifier body cannot be read', async () => {
    stubFetch(true, new SyntaxError('Unexpected token < in JSON'));

    const response = await customEventAuthorizeUser(ctx());

    expect(response).toMatchObject({ success: false, status: 401 });
  });
});
