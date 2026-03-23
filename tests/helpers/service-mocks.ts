// Centralized jest.mock() calls for services and repositories.
// jest.mock() is hoisted by Jest, so importing this file applies all mocks.
// Paths are relative to tests/helpers/ (2 levels deep from project root).

jest.mock("../../services/user.service", () => ({
  __esModule: true,
  default: {
    getByClerkUserId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    validateReferCode: jest.fn(),
    requestReferCode: jest.fn(),
    getReferralTrackerStats: jest.fn(),
  },
}));

jest.mock("../../services/address.service", () => ({
  __esModule: true,
  default: {
    getAllByUserId: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../services/activity.service", () => ({
  __esModule: true,
  default: {
    getActivities: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock("../../services/admin.service", () => ({
  __esModule: true,
  default: {
    getDashboardStats: jest.fn(),
    getUsers: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    changeUserRole: jest.fn(),
    toggleAchPush: jest.fn(),
    getActivities: jest.fn(),
    getRegistrationChart: jest.fn(),
    getActivityTypeChart: jest.fn(),
    getAccountStatusChart: jest.fn(),
    getKycActivityChart: jest.fn(),
    createPromoter: jest.fn(),
    previewReferCode: jest.fn(),
    getPromoters: jest.fn(),
    getMarketingStats: jest.fn(),
    getReferralStats: jest.fn(),
  },
}));

jest.mock("../../services/zynk.service", () => ({
  __esModule: true,
  default: {
    createEntity: jest.fn(),
    startKyc: jest.fn(),
    getKycStatus: jest.fn(),
    generatePlaidLinkToken: jest.fn(),
    addExternalAccount: jest.fn(),
    addDepositAccount: jest.fn(),
  },
}));

jest.mock("../../services/exchange-rate.service", () => ({
  __esModule: true,
  default: {
    getRate: jest.fn(),
  },
}));

jest.mock("../../services/notification.service", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    getByUserId: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../services/device.service", () => ({
  __esModule: true,
  default: {
    register: jest.fn(),
    unregister: jest.fn(),
    getUserDevices: jest.fn(),
  },
}));

jest.mock("../../services/push.service", () => ({
  __esModule: true,
  default: {
    sendToUser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../services/google-maps.service", () => ({
  __esModule: true,
  default: {
    validateAddress: jest.fn().mockResolvedValue({
      validationStatus: "VALID",
      validationGranularity: "PREMISE",
      addressComplete: true,
      formattedAddress: "123 Main St, New York, NY 10001, USA",
    }),
    getAutocompleteSuggestions: jest.fn(),
    getPlaceDetails: jest.fn(),
  },
}));

jest.mock("../../repositories/user.repository", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByClerkUserId: jest.fn(),
    findByZynkEntityId: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("../../repositories/address.repository", () => ({
  __esModule: true,
  default: {
    findAllByUserId: jest.fn(),
  },
}));

jest.mock("../../repositories/zynk.repository", () => ({
  __esModule: true,
  default: {
    createEntity: jest.fn(),
    startKyc: jest.fn(),
    getKycStatus: jest.fn(),
    addExternalAccount: jest.fn(),
    enableExternalAccount: jest.fn(),
    addDepositAccount: jest.fn(),
    generatePlaidLinkToken: jest.fn(),
  },
}));

const mockTx = {
  address: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../lib/prisma-client", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    idempotencyKey: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
  decryptNestedUser: jest.fn((obj: unknown) => obj),
  decryptUserData: jest.fn((obj: unknown) => obj),
  encryptUserData: jest.fn((obj: unknown) => obj),
}));

// Typed mock references
export const mockUserService = require("../../services/user.service").default;
export const mockAddressService = require("../../services/address.service").default;
export const mockActivityService = require("../../services/activity.service").default;
export const mockAdminService = require("../../services/admin.service").default;
export const mockZynkService = require("../../services/zynk.service").default;
export const mockExchangeRateService = require("../../services/exchange-rate.service").default;
export const mockUserRepository = require("../../repositories/user.repository").default;
export const mockAddressRepository = require("../../repositories/address.repository").default;
export const mockZynkRepository = require("../../repositories/zynk.repository").default;
export const mockNotificationService = require("../../services/notification.service").default;
export const mockDeviceService = require("../../services/device.service").default;
export const mockPushService = require("../../services/push.service").default;
export const mockGoogleMapsService = require("../../services/google-maps.service").default;
export const mockPrismaClient = require("../../lib/prisma-client").default;
export { mockTx };
