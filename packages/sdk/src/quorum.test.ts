import { describe, expect, it } from "vitest";
import { deriveQuorum } from "./quorum.js";

describe("deriveQuorum", () => {
  it("is not reached below the threshold and reports the shortfall", () => {
    expect(deriveQuorum({ votesUp: 1, votesDown: 2 }, 3)).toEqual({
      votesDown: 2,
      quorumThreshold: 3,
      reached: false,
      remaining: 1,
    });
  });

  it("is reached exactly at the threshold", () => {
    expect(deriveQuorum({ votesUp: 0, votesDown: 3 }, 3)).toMatchObject({ reached: true, remaining: 0 });
  });

  it("is reached above the threshold", () => {
    expect(deriveQuorum({ votesUp: 0, votesDown: 5 }, 3)).toMatchObject({ reached: true, remaining: 0 });
  });

  it("never counts Up votes toward quorum", () => {
    expect(deriveQuorum({ votesUp: 10, votesDown: 0 }, 3)).toMatchObject({ reached: false, remaining: 3 });
  });
});
