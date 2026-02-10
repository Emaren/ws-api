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

export function buildApiContract(serviceName: string): ApiContractDocument {
  return {
    name: serviceName,
    version: "3.0.0-auth-sessions",
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
      { method: "GET", path: "/users", summary: "List users" },
      { method: "PATCH", path: "/users/:id/role", summary: "Update user role" },
      { method: "GET", path: "/articles", summary: "List articles" },
      { method: "POST", path: "/articles", summary: "Create article" },
      { method: "GET", path: "/businesses", summary: "List businesses" },
      { method: "POST", path: "/businesses", summary: "Create business" },
      { method: "GET", path: "/inventory/items", summary: "List inventory items" },
      { method: "POST", path: "/inventory/items", summary: "Create inventory item" },
      { method: "GET", path: "/notifications/jobs", summary: "List notification jobs" },
      { method: "POST", path: "/notifications/jobs", summary: "Queue notification job" },
      { method: "GET", path: "/billing/customers", summary: "List billing customers" },
      { method: "POST", path: "/billing/customers", summary: "Create billing customer" },
      { method: "GET", path: "/rewards/ledger", summary: "List reward ledger entries" },
      { method: "POST", path: "/rewards/ledger", summary: "Create reward ledger entry" },
    ],
  };
}
