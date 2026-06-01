/** @jest-environment node */

describe('src/components/DashboardLayout.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/DashboardLayout');
    expect(mod).toBeDefined();
  });
});
