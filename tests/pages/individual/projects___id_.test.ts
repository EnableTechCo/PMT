/** @jest-environment node */

describe('src/app/projects/[id]/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/projects/[id]/page');
    expect(mod).toBeDefined();
  });
});
