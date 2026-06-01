/** @jest-environment node */

describe('src/components/TipTapEditor.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/TipTapEditor');
    expect(mod).toBeDefined();
  });
});
