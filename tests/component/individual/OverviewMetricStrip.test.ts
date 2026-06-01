/** @jest-environment node */

describe('src/components/OverviewMetricStrip.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/OverviewMetricStrip');
    expect(mod).toBeDefined();
  });
});
