/** @jest-environment node */

describe('src/app/workload/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/workload/page');
    expect(mod).toBeDefined();
  });
});
