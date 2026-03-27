import prismaClient from "../lib/prisma-client";
import { createSearchHash } from "../lib/crypto";

interface ContactResult {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
}

class ContactService {
  async search(query: string, excludeUserId: string): Promise<ContactResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const trimmed = query.trim();

    // Try exact email match via hash
    const emailHash = createSearchHash(trimmed);
    const emailMatch = await prismaClient.user.findUnique({
      where: { emailHash },
      include: { addresses: true },
    });

    if (emailMatch && emailMatch.id !== excludeUserId && emailMatch.zynkDepositAccountId) {
      return [this.toContact(emailMatch)];
    }

    // Search by name (firstName/lastName are not encrypted)
    const nameResults = await prismaClient.user.findMany({
      where: {
        AND: [
          { id: { not: excludeUserId } },
          { zynkDepositAccountId: { not: null } },
          {
            OR: [
              { firstName: { contains: trimmed, mode: "insensitive" } },
              { lastName: { contains: trimmed, mode: "insensitive" } },
            ],
          },
        ],
      },
      include: { addresses: true },
      take: 20,
    });

    return nameResults.map((u) => this.toContact(u));
  }

  private toContact(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumberPrefix: string;
    phoneNumber: string;
    addresses?: { country: string }[];
  }): ContactResult {
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: `${user.phoneNumberPrefix}${user.phoneNumber}`,
      country: user.addresses?.[0]?.country ?? "",
    };
  }
}

export default new ContactService();
