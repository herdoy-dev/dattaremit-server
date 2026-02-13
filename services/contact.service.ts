import type { CreateContactInput } from "../schemas/contact.schema";

class ContactService {
  async create(data: CreateContactInput) {
    // TODO: Implement contact form submission (e.g., send email, store in DB)
    return data;
  }
}

export default new ContactService();
