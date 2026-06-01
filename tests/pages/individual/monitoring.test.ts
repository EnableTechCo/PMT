/** @jest-environment node */

describe('src/app/monitoring/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/monitoring/page');
    expect(mod).toBeDefined();
  });
});
