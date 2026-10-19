import { describe, expect, it } from "vitest";
import { canSeeNegativePoints, displayPts } from "../src/lib/utils";

describe("negative score visibility", () => {
  it("Admin sees the actual negative score", () => {
    expect(displayPts(-13.9, canSeeNegativePoints(["admin"]))).toBe("-13,9");
  });
  it("Super Admin sees the actual negative score", () => {
    expect(displayPts(-2.25, canSeeNegativePoints(["super_admin"]))).toBe("-2,25");
  });
  it("other roles and signed-out viewers see zero", () => {
    for (const roles of [[], ["user"], ["manager"], ["admin_misiones"]]) {
      expect(displayPts(-13.9, canSeeNegativePoints(roles))).toBe("0");
    }
  });
});