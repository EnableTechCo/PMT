/** @jest-environment node */

describe('src/components/ConfirmDialog.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/ConfirmDialog');
    expect(mod).toBeDefined();
  });
});
