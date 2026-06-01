/** @jest-environment node */

describe('src/app/teams/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/teams/page');
    expect(mod).toBeDefined();
  });
});
