import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conditional classes", () => {
    const value = cn("px-2", false && "py-2", "text-sm", "px-4");
    expect(value).toContain("px-4");
    expect(value).toContain("text-sm");
  });
});
