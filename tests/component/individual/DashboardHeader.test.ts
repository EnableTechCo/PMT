/** @jest-environment node */

describe('src/components/DashboardHeader.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/DashboardHeader');
    expect(mod).toBeDefined();
  });
});
