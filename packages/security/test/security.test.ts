import { describe, expect, it } from "vitest";
import { can, decryptValue, encryptValue, sanitizeForDlp } from "../src/index.js";

describe("security", () => {
  it("checks permissions", () => {
    const allowed = can(
      {
        userId: "u1",
        roles: ["admin"],
        projectId: "p1"
      },
      "tool:approve"
    );
    expect(allowed).toBe(true);
  });

  it("encrypts and decrypts values", () => {
    const encoded = encryptValue("secret-value");
    const decoded = decryptValue(encoded);
    expect(decoded).toBe("secret-value");
  });

  it("redacts pii", () => {
    const clean = sanitizeForDlp("email me at user@example.com");
    expect(clean).toContain("[REDACTED]");
  });
});
