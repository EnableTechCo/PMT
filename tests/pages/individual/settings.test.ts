/** @jest-environment node */

describe('src/app/settings/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/settings/page');
    expect(mod).toBeDefined();
  });
});
