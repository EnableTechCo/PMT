/** @jest-environment node */

describe('src/app/workflows/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/workflows/page');
    expect(mod).toBeDefined();
  });
});
