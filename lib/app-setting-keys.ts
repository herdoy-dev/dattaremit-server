export const APP_SETTING_KEYS = {
  WEEKLY_TRANSFER_LIMIT_USD: "WEEKLY_TRANSFER_LIMIT_USD",
} as const;

export const APP_SETTING_DEFAULTS: Record<string, string> = {
  WEEKLY_TRANSFER_LIMIT_USD: "10000",
};
