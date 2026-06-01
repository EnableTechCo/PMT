/** @jest-environment node */

describe('src/app/auth/reset-password/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/auth/reset-password/page');
    expect(mod).toBeDefined();
  });
});
