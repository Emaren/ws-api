import { HttpError } from "../../shared/http-error.js";
import type { BusinessRecord } from "../../shared/models.js";
import type { BusinessesRepository } from "./businesses.repository.js";

interface CreateBusinessInput {
  name: string;
  ownerUserId: string;
  contactEmail: string;
}

export class BusinessesService {
  constructor(private readonly businessesRepository: BusinessesRepository) {}

  listBusinesses(): BusinessRecord[] {
    return this.businessesRepository.list();
  }

  createBusiness(input: CreateBusinessInput): BusinessRecord {
    if (!input.name.trim() || !input.ownerUserId.trim()) {
      throw new HttpError(400, "Missing business name or ownerUserId");
    }

    return this.businessesRepository.create({
      name: input.name.trim(),
      ownerUserId: input.ownerUserId.trim(),
      contactEmail: input.contactEmail.trim() || null,
    });
  }
}
