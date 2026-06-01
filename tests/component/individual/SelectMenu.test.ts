/** @jest-environment node */

describe('src/components/SelectMenu.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/SelectMenu');
    expect(mod).toBeDefined();
  });
});
