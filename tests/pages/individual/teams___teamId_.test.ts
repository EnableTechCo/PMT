/** @jest-environment node */

describe('src/app/teams/[teamId]/page.tsx', () => {
  it('loads as an individual page test', async () => {
    const mod = await import('@/app/teams/[teamId]/page');
    expect(mod).toBeDefined();
  });
});
