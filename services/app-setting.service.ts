import appSettingRepository from "../repositories/app-setting.repository";
import { APP_SETTING_KEYS, APP_SETTING_DEFAULTS } from "../lib/app-setting-keys";
import AppError from "../lib/AppError";

class AppSettingService {
  async getWeeklyTransferLimitUsd(): Promise<number> {
    const setting = await appSettingRepository.findByKey(
      APP_SETTING_KEYS.WEEKLY_TRANSFER_LIMIT_USD,
    );
    const raw = setting?.value ?? APP_SETTING_DEFAULTS.WEEKLY_TRANSFER_LIMIT_USD;
    return parseFloat(raw);
  }

  async updateSetting(key: string, value: string, adminId: string) {
    if (!Object.values(APP_SETTING_KEYS).includes(key as any)) {
      throw new AppError(400, `Unknown setting key: ${key}`);
    }
    return appSettingRepository.upsert(key, value, adminId);
  }

  async getAllSettings() {
    const dbSettings = await appSettingRepository.findAll();
    const settingsMap: Record<
      string,
      { value: string; updatedBy: string | null; updated_at: string | null }
    > = {};
    for (const key of Object.keys(APP_SETTING_DEFAULTS)) {
      settingsMap[key] = { value: APP_SETTING_DEFAULTS[key], updatedBy: null, updated_at: null };
    }
    for (const s of dbSettings) {
      settingsMap[s.key] = {
        value: s.value,
        updatedBy: s.updatedBy,
        updated_at: s.updated_at.toISOString(),
      };
    }
    return settingsMap;
  }
}

export default new AppSettingService();
