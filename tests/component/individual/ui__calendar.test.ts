/** @jest-environment node */

describe('src/components/ui/calendar.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/ui/calendar');
    expect(mod).toBeDefined();
  });
});
