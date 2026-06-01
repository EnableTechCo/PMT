/** @jest-environment node */

describe("src/app/feedback/page.tsx", () => {
  it("loads as an individual page test", async () => {
    const mod = await import("@/app/feedback/page");
    expect(mod).toBeDefined();
  });
});
