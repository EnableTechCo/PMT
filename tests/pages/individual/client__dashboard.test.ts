/** @jest-environment node */

describe('src/app/client/dashboard/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/client/dashboard/page');
    expect(mod).toBeDefined();
  });
});
