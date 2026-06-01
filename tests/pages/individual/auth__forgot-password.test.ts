/** @jest-environment node */

describe('src/app/auth/forgot-password/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/auth/forgot-password/page');
    expect(mod).toBeDefined();
  });
});
