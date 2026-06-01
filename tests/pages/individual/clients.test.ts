/** @jest-environment node */

describe('src/app/clients/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/clients/page');
    expect(mod).toBeDefined();
  });
});
