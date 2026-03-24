import AppError from "../lib/AppError";
import deviceRepository from "../repositories/device.repository";
import type { RegisterDeviceInput } from "../schemas/device.schema";

class DeviceService {
  async register(userId: string, data: RegisterDeviceInput) {
    return deviceRepository.upsertByToken({
      userId,
      expoPushToken: data.expoPushToken,
      platform: data.platform,
      deviceName: data.deviceName,
    });
  }

  async unregister(id: string, userId: string) {
    try {
      return await deviceRepository.deleteByIdAndUserId(id, userId);
    } catch {
      throw new AppError(404, "Device not found");
    }
  }

  async getUserDevices(userId: string) {
    return deviceRepository.findByUserId(userId);
  }
}

export default new DeviceService();
