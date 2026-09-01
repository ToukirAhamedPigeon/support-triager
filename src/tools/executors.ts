import { findCustomerByEmail } from "../data/customers.js";
import { findOrdersByEmail } from "../data/orders.js";
import { findTicketsByEmail, createTicket, type Ticket } from "../data/tickets.js";

export type ToolName = "lookup_customer" | "fetch_recent_orders" | "fetch_recent_tickets" | "create_ticket";

export function executeTool(name: string, input: Record<string, unknown>): unknown {
  switch (name as ToolName) {
    case "lookup_customer": {
      const email = String(input.email ?? "");
      const customer = findCustomerByEmail(email);
      return customer ?? { found: false, message: `No customer account found for ${email}` };
    }
    case "fetch_recent_orders": {
      const email = String(input.email ?? "");
      return { orders: findOrdersByEmail(email) };
    }
    case "fetch_recent_tickets": {
      const email = String(input.email ?? "");
      return { tickets: findTicketsByEmail(email) };
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
