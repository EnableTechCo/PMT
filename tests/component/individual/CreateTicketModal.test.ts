/** @jest-environment node */

describe('src/components/CreateTicketModal.tsx', () => {
  it('loads as an individual module test', async () => {
    const mod = await import('@/components/CreateTicketModal');
    expect(mod).toBeDefined();
  });
});
