import { findCustomerByEmail } from "../data/customers.js";
import { findOrdersByEmail } from "../data/orders.js";
import { findTicketsByEmail, createTicket, type Ticket } from "../data/tickets.js";

export type ToolName = "lookup_customer" | "fetch_recent_orders" | "fetch_recent_tickets" | "create_ticket";

export function executeTool(name: string, input: Record<string, unknown>): unknown {
  switch (name as ToolName) {
    case "lookup_customer": {
      const email = String(input.email ?? "");
      const customer = findCustomerByEmail(email);
      // Trimmed to what triage reasoning uses (Step 8 lever 2) — email and
      // exact signup date are redundant/unused; name/company/plan drive
      // urgency and team judgment.
      return customer ? { name: customer.name, company: customer.company, plan: customer.plan } : { found: false };
    }
    case "fetch_recent_orders": {
      const email = String(input.email ?? "");
      const orders = findOrdersByEmail(email).map((o) => ({ product: o.product, amountUsd: o.amountUsd, status: o.status, date: o.date }));
      return { orders };
    }
    case "fetch_recent_tickets": {
      const email = String(input.email ?? "");
      const tickets = findTicketsByEmail(email).map((t) => ({ subject: t.subject, priority: t.priority, team: t.team, status: t.status }));
      return { tickets };
    }
    case "create_ticket": {
      const ticket: Ticket = createTicket({
        customerEmail: String(input.customer_email ?? ""),
        subject: String(input.subject ?? ""),
        priority: input.priority as Ticket["priority"],
        team: String(input.team ?? ""),
      });
      return ticket;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
