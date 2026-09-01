export interface Order {
  orderId: string;
  customerEmail: string;
  product: string;
  amountUsd: number;
  status: "paid" | "refunded" | "failed" | "pending";
  date: string;
}

export const ORDERS: Order[] = [
  { orderId: "ord_1001", customerEmail: "jordan.lee@acme-corp.com", product: "Pro Plan - Monthly", amountUsd: 49, status: "paid", date: "2026-08-01" },
  { orderId: "ord_1002", customerEmail: "jordan.lee@acme-corp.com", product: "Pro Plan - Monthly", amountUsd: 49, status: "paid", date: "2026-08-01" },
  { orderId: "ord_1003", customerEmail: "maria.chen@globex.io", product: "Enterprise Plan - Annual", amountUsd: 12000, status: "paid", date: "2026-01-15" },
  { orderId: "ord_1004", customerEmail: "priya.nair@initech.co", product: "Pro Plan - Monthly", amountUsd: 49, status: "paid", date: "2026-08-05" },
  { orderId: "ord_1005", customerEmail: "devon.reyes@umbrella.dev", product: "Enterprise Plan - Annual", amountUsd: 15000, status: "paid", date: "2026-02-01" },
  { orderId: "ord_1006", customerEmail: "sam.okafor@brightpath.com", product: "Pro Plan - Monthly", amountUsd: 49, status: "pending", date: "2026-08-25" },
  { orderId: "ord_1007", customerEmail: "taylor.singh@wayneenterprises.com", product: "Enterprise Plan - Annual", amountUsd: 20000, status: "paid", date: "2025-12-10" },
];

export function findOrdersByEmail(email: string): Order[] {
  return ORDERS.filter((o) => o.customerEmail.toLowerCase() === email.toLowerCase());
}
