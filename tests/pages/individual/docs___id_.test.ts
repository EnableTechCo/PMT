/** @jest-environment node */

describe('src/app/docs/[id]/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/docs/[id]/page');
    expect(mod).toBeDefined();
  });
});
