import addressRepository from "../repositories/address.repository";
import { toPublicUser } from "../lib/dto";
import userRepository from "../repositories/user.repository";

class AccountService {
  async getAccount(clerkUserId: string) {
    const user = await userRepository.findByClerkUserId(clerkUserId);
    const addresses = user
      ? await addressRepository.findAllByUserId(user.id)
      : [];

    return {
      user: user ? toPublicUser(user) : null,
      addresses,
      accountStatus: user?.accountStatus ?? "INITIAL",
    };
  }
}

export default new AccountService();
