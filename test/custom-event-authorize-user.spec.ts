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
      event: 'custom.event.authorize.user',
      created_at: '2026-01-01T00:00:00Z',
      merchant: 1234,
      data: { hello: 'world' }
    },
    merchant: { id: 1234 },
    settings: {},
    authorization: authorization ?? undefined
  }) as SallaCustomEvent;

/** Stubs `fetch` and hands back the spy so a test can assert it never ran. */
const stubFetch = (ok: boolean, body: unknown = { active: true }, status = ok ? 200 : 401) => {
  const spy = vi.fn(async () => ({ ok, status, json: async () => body }));
  vi.stubGlobal('fetch', spy);
  return spy;
};

afterEach(() => vi.unstubAllGlobals());

describe('custom.event.authorize.user', () => {
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
      headers: { Authorization: 'Bearer good' }
    });
    expect(response).toMatchObject({ success: true, status: 200 });
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
});
