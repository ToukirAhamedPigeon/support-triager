export interface Customer {
  email: string;
  name: string;
  company: string;
  plan: "free" | "pro" | "enterprise";
  accountCreated: string;
}

export const CUSTOMERS: Customer[] = [
  { email: "jordan.lee@acme-corp.com", name: "Jordan Lee", company: "Acme Corp", plan: "pro", accountCreated: "2024-03-12" },
  { email: "maria.chen@globex.io", name: "Maria Chen", company: "Globex", plan: "enterprise", accountCreated: "2023-11-02" },
  { email: "sam.okafor@brightpath.com", name: "Sam Okafor", company: "BrightPath", plan: "free", accountCreated: "2026-06-20" },
  { email: "priya.nair@initech.co", name: "Priya Nair", company: "Initech", plan: "pro", accountCreated: "2025-01-08" },
  { email: "devon.reyes@umbrella.dev", name: "Devon Reyes", company: "Umbrella", plan: "enterprise", accountCreated: "2022-07-15" },
  { email: "alex.kim@stark-industries.com", name: "Alex Kim", company: "Stark Industries", plan: "pro", accountCreated: "2024-09-30" },
  { email: "taylor.singh@wayneenterprises.com", name: "Taylor Singh", company: "Wayne Enterprises", plan: "enterprise", accountCreated: "2023-02-18" },
  { email: "jamie.osei@hooli.com", name: "Jamie Osei", company: "Hooli", plan: "free", accountCreated: "2026-08-01" },
];

export function findCustomerByEmail(email: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.email.toLowerCase() === email.toLowerCase());
}
