export interface ApiContractRoute {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
}

export interface ApiContractDocument {
  name: string;
  version: string;
  generatedAt: string;
  routes: ApiContractRoute[];
}

function buildCrudRoutes(basePath: string, summaryLabel: string): ApiContractRoute[] {
  return [
    { method: "GET", path: basePath, summary: `List ${summaryLabel}` },
    { method: "GET", path: `${basePath}/:id`, summary: `Get ${summaryLabel} record by id` },
    { method: "POST", path: basePath, summary: `Create ${summaryLabel} record` },
    { method: "PATCH", path: `${basePath}/:id`, summary: `Update ${summaryLabel} record` },
    { method: "DELETE", path: `${basePath}/:id`, summary: `Delete ${summaryLabel} record` },
  ];
}

export function buildApiContract(serviceName: string): ApiContractDocument {
  return {
    name: serviceName,
    version: "3.9.0-shared-contract-client",
    generatedAt: new Date().toISOString(),
    routes: [
      { method: "GET", path: "/", summary: "Service identity" },
      { method: "GET", path: "/ping", summary: "Lightweight ping" },
      { method: "GET", path: "/health", summary: "Liveness + module counters" },
      { method: "GET", path: "/api/health", summary: "Liveness alias" },
      { method: "GET", path: "/ready", summary: "Readiness checks" },
      { method: "GET", path: "/api/ready", summary: "Readiness alias" },
      { method: "GET", path: "/api/contract", summary: "Machine-readable API contract" },
      { method: "POST", path: "/auth/register", summary: "Register a user" },
      { method: "POST", path: "/auth/login", summary: "Login user" },
      { method: "POST", path: "/auth/logout", summary: "Logout session" },
      {
        method: "POST",
        path: "/auth/password/reset",
        summary: "Internal bridge password reset (requires x-ws-bridge-key)",
      },
      { method: "GET", path: "/auth/me", summary: "Get current user from bearer session" },
      { method: "GET", path: "/auth/session", summary: "Get current session details" },
      { method: "POST", path: "/api/register", summary: "Legacy register alias" },
      { method: "POST", path: "/login", summary: "Legacy login alias" },
      { method: "POST", path: "/logout", summary: "Legacy logout alias" },
      { method: "GET", path: "/me", summary: "Legacy me alias" },
      { method: "GET", path: "/session", summary: "Legacy session alias" },
      { method: "POST", path: "/api/auth/logout", summary: "Alias for logout" },
      { method: "GET", path: "/api/auth/me", summary: "Alias for me" },
      { method: "GET", path: "/api/auth/session", summary: "Alias for session" },
      {
        method: "POST",
        path: "/api/auth/password/reset",
        summary: "Alias for internal bridge password reset",
      },
      { method: "GET", path: "/auth/wallet", summary: "Get linked wallet for current session user" },
      { method: "POST", path: "/auth/wallet/challenge", summary: "Create wallet signature challenge" },
      { method: "POST", path: "/auth/wallet/link", summary: "Verify signature and link wallet" },
      { method: "DELETE", path: "/auth/wallet", summary: "Unlink wallet from current user" },
      { method: "GET", path: "/ops/wallet-links", summary: "List linked wallets for owner/admin ops" },
      { method: "GET", path: "/users", summary: "List users" },
      { method: "PATCH", path: "/users/:id/role", summary: "Update user role" },
      { method: "GET", path: "/articles", summary: "List articles" },
      { method: "GET", path: "/articles/:slug", summary: "Get article by slug" },
      { method: "POST", path: "/articles", summary: "Create article" },
      { method: "PATCH", path: "/articles/:slug", summary: "Update article" },
      { method: "DELETE", path: "/articles/:slug", summary: "Delete article" },
      { method: "GET", path: "/businesses", summary: "List businesses" },
      { method: "POST", path: "/businesses", summary: "Create business" },
      { method: "GET", path: "/inventory/items", summary: "List inventory items" },
      { method: "POST", path: "/inventory/items", summary: "Create inventory item" },
      { method: "GET", path: "/notifications/jobs", summary: "List notification jobs" },
      { method: "GET", path: "/notifications/audit", summary: "List notification audit logs" },
      { method: "GET", path: "/notifications/jobs/:id/audit", summary: "List audit logs for a single job" },
      { method: "POST", path: "/notifications/jobs", summary: "Queue notification job" },
      { method: "POST", path: "/notifications/jobs/process", summary: "Process due notification queue jobs" },
      { method: "POST", path: "/notifications/jobs/:id/retry", summary: "Force a notification job retry" },
      { method: "GET", path: "/billing/customers", summary: "List billing customers" },
      { method: "POST", path: "/billing/customers", summary: "Create billing customer" },
      { method: "GET", path: "/rewards/rules", summary: "List off-chain reward accrual rules" },
      { method: "GET", path: "/rewards/ledger", summary: "List reward ledger entries" },
      { method: "POST", path: "/rewards/accrual", summary: "Accrue off-chain rewards through rule engine" },
      { method: "POST", path: "/rewards/ledger", summary: "Owner/Admin manual reward ledger grant" },
      { method: "GET", path: "/rewards/report", summary: "Owner/Admin rewards accrual reporting summary" },
      { method: "GET", path: "/rewards/export", summary: "Owner/Admin reward export preview (JSON/CSV)" },
      { method: "POST", path: "/rewards/export/mark", summary: "Owner/Admin mark pending rewards as exported batch" },
      { method: "POST", path: "/rewards/export/settle", summary: "Owner/Admin settle exported rewards with payout tx hash" },
      ...buildCrudRoutes("/ops/businesses", "business ops businesses"),
      ...buildCrudRoutes("/ops/store-profiles", "store profiles"),
      ...buildCrudRoutes("/ops/inventory-items", "business ops inventory items"),
      ...buildCrudRoutes("/ops/pricing-rules", "business ops pricing rules"),
      ...buildCrudRoutes("/ops/offers", "business ops offers"),
      ...buildCrudRoutes("/ops/campaigns", "business ops campaigns"),
      ...buildCrudRoutes("/ops/notification-recipients", "notification recipients"),
      ...buildCrudRoutes("/ops/delivery-leads", "delivery leads"),
      ...buildCrudRoutes("/ops/affiliate-clicks", "affiliate clicks"),
      ...buildCrudRoutes("/ops/reward-ledger", "business ops reward ledger"),
      { method: "GET", path: "/ops/counts", summary: "Count business ops records by resource" },
      { method: "POST", path: "/ops/pricing/quote", summary: "Compute deterministic dynamic price quote" },
    ],
  };
}
