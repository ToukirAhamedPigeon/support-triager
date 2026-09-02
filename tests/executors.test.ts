import { describe, it, expect } from "vitest";
import { executeTool } from "../src/tools/executors";

describe("lookup_customer", () => {
  it("returns the customer profile for a known email", () => {
    const result = executeTool("lookup_customer", { email: "jordan.lee@acme-corp.com" }) as any;
    expect(result.name).toBe("Jordan Lee");
    expect(result.plan).toBe("pro");
  });

  it("returns a not-found result for an unknown email", () => {
    const result = executeTool("lookup_customer", { email: "nobody@nowhere.test" }) as any;
    expect(result.found).toBe(false);
  });
});

describe("fetch_recent_orders", () => {
  it("returns matching orders for a known customer", () => {
    const result = executeTool("fetch_recent_orders", { email: "jordan.lee@acme-corp.com" }) as any;
    expect(result.orders.length).toBe(2);
    expect(result.orders[0].product).toBe("Pro Plan - Monthly");
  });

  it("returns an empty list for an unknown customer", () => {
    const result = executeTool("fetch_recent_orders", { email: "nobody@nowhere.test" }) as any;
    expect(result.orders).toEqual([]);
  });
});

describe("fetch_recent_tickets", () => {
  it("returns prior tickets for a known customer", () => {
    const result = executeTool("fetch_recent_tickets", { email: "priya.nair@initech.co" }) as any;
    expect(result.tickets.length).toBe(1);
    expect(result.tickets[0].team).toBe("engineering");
  });
});

describe("create_ticket", () => {
  it("creates a ticket with a generated id and open status", () => {
    const result = executeTool("create_ticket", {
      customer_email: "new.customer@example.com",
      subject: "Test issue",
      priority: "high",
      team: "engineering",
    }) as any;
    expect(result.ticketId).toMatch(/^tkt_\d+$/);
    expect(result.status).toBe("open");
    expect(result.priority).toBe("high");
  });

  it("the created ticket is then findable by fetch_recent_tickets", () => {
    executeTool("create_ticket", {
      customer_email: "another.customer@example.com",
      subject: "Second test issue",
      priority: "low",
      team: "customer_success",
    });
    const result = executeTool("fetch_recent_tickets", { email: "another.customer@example.com" }) as any;
    expect(result.tickets.some((t: any) => t.subject === "Second test issue")).toBe(true);
  });
});

describe("unknown tool", () => {
  it("throws for an undefined tool name", () => {
    expect(() => executeTool("not_a_real_tool", {})).toThrow();
  });
});
