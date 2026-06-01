/** @jest-environment node */

describe('src/app/auth/invite/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/auth/invite/page');
    expect(mod).toBeDefined();
  });
});
