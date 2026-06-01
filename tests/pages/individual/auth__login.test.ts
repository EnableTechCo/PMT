/** @jest-environment node */

describe('src/app/auth/login/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/auth/login/page');
    expect(mod).toBeDefined();
  });
});
