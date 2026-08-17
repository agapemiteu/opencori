import { describe, expect, it } from "vitest";

import { FEEDBACK_CATEGORIES, SUGGESTED_SERVICES } from "../src/components/service-options.js";

describe("ALAT demo service options", () => {
  it("maps each stable service id to an explicit feedback category", () => {
    expect(new Set(SUGGESTED_SERVICES.map(({ id }) => id)).size).toBe(SUGGESTED_SERVICES.length);
    expect(SUGGESTED_SERVICES.map(({ feedbackCategory }) => feedbackCategory)).toEqual([
      "Card Issuance",
      "Account Opening",
      "Deposit / Withdrawal",
      "Loan Services",
      "Enquiry / Support",
    ]);
    expect(
      SUGGESTED_SERVICES.every(({ feedbackCategory }) =>
        FEEDBACK_CATEGORIES.includes(feedbackCategory),
      ),
    ).toBe(true);
  });
});
