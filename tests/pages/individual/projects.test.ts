/** @jest-environment node */

describe('src/app/projects/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/projects/page');
    expect(mod).toBeDefined();
  });
});
