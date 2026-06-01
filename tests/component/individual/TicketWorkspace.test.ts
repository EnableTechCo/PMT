/** @jest-environment node */

describe('src/components/TicketWorkspace.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/TicketWorkspace');
    expect(mod).toBeDefined();
  });
});
