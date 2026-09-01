export interface KbArticle {
  id: string;
  title: string;
  tags: string[];
  body: string;
}

export const KB_ARTICLES: KbArticle[] = [
  {
    id: "kb_sso_setup",
    title: "Setting up SSO for your organization",
    tags: ["sso", "sign-in", "saml", "how_to"],
    body: "Go to Settings > Security > SSO, enter your identity provider's metadata URL, then assign at least one admin as a fallback login before enforcing SSO org-wide.",
  },
  {
    id: "kb_password_reset_not_arriving",
    title: "Password reset email not arriving",
    tags: ["account_access", "password", "email"],
    body: "Reset emails can take up to 5 minutes and are frequently caught by corporate spam filters. If it still hasn't arrived after 10 minutes, an admin can trigger a manual reset link from the Users panel — this bypasses the email queue entirely.",
  },
  {
    id: "kb_csv_export_shortcuts",
    title: "Keyboard shortcuts and CSV export tips",
    tags: ["how_to", "export", "shortcuts"],
    body: "Press Ctrl+D (Cmd+D on Mac) to duplicate the selected row. CSV exports respect your account's locale date format under Settings > Preferences.",
  },
  {
    id: "kb_bulk_discount_tiers",
    title: "How bulk and tiered discounts stack",
    tags: ["billing", "discount", "pricing"],
    body: "Volume discount tiers apply to subtotal thresholds and are evaluated independently from the bulk-order-quantity discount; both can apply to the same order and are additive.",
  },
  {
    id: "kb_known_phishing_pattern",
    title: "Known phishing pattern impersonating billing emails",
    tags: ["security", "phishing"],
    body: "We've had prior reports of emails impersonating our billing team asking customers to 're-verify payment info' via a lookalike domain. We never ask for payment re-verification by email link — always confirm through the in-app billing page.",
  },
];
