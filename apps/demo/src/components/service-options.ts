export const FEEDBACK_CATEGORIES = [
  "Card Issuance",
  "Account Opening",
  "Enquiry / Support",
  "Loan Services",
  "Deposit / Withdrawal",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const SUGGESTED_SERVICES: readonly {
  id: string;
  label: string;
  feedbackCategory: FeedbackCategory;
}[] = [
  {
    id: "card-service",
    label: "Card Pickup / Replacement",
    feedbackCategory: "Card Issuance",
  },
  {
    id: "account-service",
    label: "Account Opening & BVN Linking",
    feedbackCategory: "Account Opening",
  },
  {
    id: "cash-service",
    label: "Cash Withdrawal / Deposit",
    feedbackCategory: "Deposit / Withdrawal",
  },
  {
    id: "loan-service",
    label: "Loan Inquiry / Application",
    feedbackCategory: "Loan Services",
  },
  {
    id: "support-service",
    label: "Customer Support / Complaints",
    feedbackCategory: "Enquiry / Support",
  },
];
