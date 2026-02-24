import { describe, expect, it } from "vitest";
import { createDefaultGateway } from "../src/index.js";

describe("a2a-gateway", () => {
  it("lists registered cards", () => {
    const gateway = createDefaultGateway();
    expect(gateway.listCards().length).toBeGreaterThan(1);
  });

  it("returns completed result for known agent", async () => {
    const gateway = createDefaultGateway();
    const result = await gateway.submitTask({
      requestId: "req-1",
      sourceAgent: "orchestrator",
      targetAgent: "planner",
      objective: "Build execution plan",
      payload: {}
    });
    expect(result.status).toBe("completed");
  });
});
