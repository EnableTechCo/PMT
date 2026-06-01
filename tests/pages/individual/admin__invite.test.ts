/** @jest-environment node */

describe('src/app/admin/invite/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/admin/invite/page');
    expect(mod).toBeDefined();
  });
});
