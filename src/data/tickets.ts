export interface Ticket {
  ticketId: string;
  customerEmail: string;
  subject: string;
  priority: "critical" | "high" | "normal" | "low";
  team: string;
  createdAt: string;
  status: "open" | "closed";
}

let nextTicketNumber = 5001;

export const TICKETS: Ticket[] = [
  { ticketId: "tkt_4801", customerEmail: "jordan.lee@acme-corp.com", subject: "Question about annual billing discount", priority: "low", team: "billing_support", createdAt: "2026-05-14", status: "closed" },
  { ticketId: "tkt_4855", customerEmail: "maria.chen@globex.io", subject: "SSO metadata URL not accepted", priority: "normal", team: "customer_success", createdAt: "2026-06-02", status: "closed" },
  { ticketId: "tkt_4902", customerEmail: "priya.nair@initech.co", subject: "Webhook retry policy question", priority: "normal", team: "engineering", createdAt: "2026-07-20", status: "closed" },
];

export function findTicketsByEmail(email: string): Ticket[] {
  return TICKETS.filter((t) => t.customerEmail.toLowerCase() === email.toLowerCase());
}

export function createTicket(input: {
  customerEmail: string;
  subject: string;
  priority: Ticket["priority"];
  team: string;
}): Ticket {
  const ticket: Ticket = {
    ticketId: `tkt_${nextTicketNumber++}`,
    customerEmail: input.customerEmail,
    subject: input.subject,
    priority: input.priority,
    team: input.team,
    createdAt: new Date().toISOString().slice(0, 10),
    status: "open",
  };
  TICKETS.push(ticket);
  return ticket;
}
