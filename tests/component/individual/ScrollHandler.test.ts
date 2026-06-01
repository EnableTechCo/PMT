/** @jest-environment node */

describe('src/components/ScrollHandler.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/ScrollHandler');
    expect(mod).toBeDefined();
  });
});
