/** @jest-environment node */

describe('src/app/docs/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/docs/page');
    expect(mod).toBeDefined();
  });
});
