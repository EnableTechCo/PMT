/** @jest-environment node */

describe('src/components/Pagination.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/Pagination');
    expect(mod).toBeDefined();
  });
});
