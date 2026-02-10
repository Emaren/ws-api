import { HttpError } from "../../shared/http-error.js";
import type {
  BillingCustomerRecord,
  BillingPlan,
  BillingStatus,
} from "../../shared/models.js";
import type { BillingRepository } from "./billing.repository.js";

const VALID_PLANS: BillingPlan[] = ["FREE", "BASIC", "PRO"];
const DEFAULT_STATUS: BillingStatus = "active";

interface CreateBillingCustomerInput {
  userId: string;
  plan: string;
  stripeCustomerId: string;
  periodEnd: string;
}

export class BillingService {
  constructor(private readonly billingRepository: BillingRepository) {}

  listCustomers(): BillingCustomerRecord[] {
    return this.billingRepository.listCustomers();
  }

  createCustomer(input: CreateBillingCustomerInput): BillingCustomerRecord {
    if (!input.userId.trim()) {
      throw new HttpError(400, "Missing userId");
    }

    if (!VALID_PLANS.includes(input.plan as BillingPlan)) {
      throw new HttpError(400, "Invalid billing plan");
    }

    return this.billingRepository.createCustomer({
      userId: input.userId.trim(),
      plan: input.plan as BillingPlan,
      stripeCustomerId: input.stripeCustomerId.trim() || null,
      status: DEFAULT_STATUS,
      periodEnd: input.periodEnd.trim() || null,
    });
  }
}
