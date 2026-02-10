import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { BillingCustomerRecord, BillingPlan, BillingStatus } from "../../shared/models.js";

export interface CreateBillingCustomerParams {
  userId: string;
  plan: BillingPlan;
  stripeCustomerId: string | null;
  status: BillingStatus;
  periodEnd: string | null;
}

export interface BillingRepository {
  listCustomers(): BillingCustomerRecord[];
  createCustomer(params: CreateBillingCustomerParams): BillingCustomerRecord;
}

export class InMemoryBillingRepository implements BillingRepository {
  constructor(private readonly store: MemoryStore) {}

  listCustomers(): BillingCustomerRecord[] {
    return [...this.store.billingCustomers];
  }

  createCustomer(params: CreateBillingCustomerParams): BillingCustomerRecord {
    const timestamp = nowIso();
    const customer: BillingCustomerRecord = {
      id: createId("bil"),
      userId: params.userId,
      plan: params.plan,
      stripeCustomerId: params.stripeCustomerId,
      status: params.status,
      periodEnd: params.periodEnd,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.billingCustomers.push(customer);
    return customer;
  }
}
