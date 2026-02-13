import addressRepository from "../repositories/address.repository";
import userRepository from "../repositories/user.repository";

class AccountService {
  async getAccount(clerkUserId: string) {
    const user = await userRepository.findByClerkUserId(clerkUserId);
    const addresses = user
      ? await addressRepository.findAllByUserId(user.id)
      : [];

    return {
      user: user ?? null,
      addresses,
      wallet: null,
      accountStatus: user?.accountStatus ?? "INITIAL",
    };
  }
}

export default new AccountService();
