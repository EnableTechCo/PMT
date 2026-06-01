/** @jest-environment node */

describe('src/components/QuickStats.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/QuickStats');
    expect(mod).toBeDefined();
  });
});
