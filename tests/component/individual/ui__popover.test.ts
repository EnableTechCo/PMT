/** @jest-environment node */

describe('src/components/ui/popover.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/ui/popover');
    expect(mod).toBeDefined();
  });
});
