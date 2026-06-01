/** @jest-environment node */

import { GET } from "@/app/api/health/route";
import { countUsers } from "@/lib/user-store";

jest.mock("@/lib/user-store", () => ({
  countUsers: jest.fn(),
}));

const countUsersMock = countUsers as jest.MockedFunction<typeof countUsers>;

describe("GET /api/health", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns healthy when database check passes", async () => {
    countUsersMock.mockResolvedValue(1);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
  });

  it("returns unhealthy when database check fails", async () => {
    countUsersMock.mockRejectedValue(new Error("db down"));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");

    consoleErrorSpy.mockRestore();
  });
});
