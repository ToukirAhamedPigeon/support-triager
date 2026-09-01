import type Anthropic from "@anthropic-ai/sdk";

/**
 * All four tools key off `customer_email` directly (not a chained customer_id),
 * so lookup_customer / fetch_recent_orders / fetch_recent_tickets have no
 * dependency on each other's output — this is what makes them safe to call
 * in parallel in a single turn (Step 6).
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "lookup_customer",
    description:
      "Look up a customer's account profile (name, company, plan tier, account age) by their email address. Returns not-found if no account matches.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "The customer's email address, exactly as given in the support message." },
      },
      required: ["email"],
    },
  },
  {
    name: "fetch_recent_orders",
    description: "Fetch a customer's recent billing/order history by email address. Returns an empty list if none found.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "The customer's email address." },
      },
      required: ["email"],
    },
  },
  {
    name: "fetch_recent_tickets",
    description: "Fetch a customer's recent (closed and open) support tickets by email address, for context on prior issues. Returns an empty list if none found.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "The customer's email address." },
      },
      required: ["email"],
    },
  },
  {
    name: "create_ticket",
    description: "Create a new support ticket, routing it to the correct team at the correct priority. Call this once you've finished triaging the message.",
    input_schema: {
      type: "object",
      properties: {
        customer_email: { type: "string", description: "The customer's email address." },
        subject: { type: "string", description: "A short subject line summarizing the issue." },
        priority: { type: "string", enum: ["critical", "high", "normal", "low"] },
        team: {
          type: "string",
          enum: ["billing_support", "engineering", "customer_success", "security_team", "sales_team"],
        },
      },
      required: ["customer_email", "subject", "priority", "team"],
    },
  },
];
