/** @jest-environment node */

describe('src/components/ui/button.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/ui/button');
    expect(mod).toBeDefined();
  });
});
