/** @jest-environment node */

describe('src/app/auth/signup/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/auth/signup/page');
    expect(mod).toBeDefined();
  });
});
