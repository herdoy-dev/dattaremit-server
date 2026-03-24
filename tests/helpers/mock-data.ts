export const mockUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  clerkUserId: "user_test123",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phoneNumberPrefix: "+1",
  phoneNumber: "1234567890",
  dateOfBirth: new Date("1990-01-01"),
  nationality: "US",
  role: "USER" as const,
  accountStatus: "INITIAL" as const,
  zynkEntityId: null,
  referCode: null,
  referredByCode: null,
  achPushEnabled: false,
  referValue: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockAdminUser = {
  ...mockUser,
  id: "550e8400-e29b-41d4-a716-446655440001",
  clerkUserId: "user_admin123",
  email: "admin@example.com",
  role: "ADMIN" as const,
  accountStatus: "ACTIVE" as const,
};

export const mockActiveUser = {
  ...mockUser,
  accountStatus: "ACTIVE" as const,
  zynkEntityId: "zynk_entity_123",
  addresses: [{ id: "addr-1" }],
};

export const mockAddress = {
  id: "660e8400-e29b-41d4-a716-446655440000",
  type: "PRESENT" as const,
  addressLine1: "123 Main St",
  addressLine2: "Apt 4B",
  city: "New York",
  state: "New York",
  country: "US" as const,
  postalCode: "10001",
  isDefault: true,
  userId: mockUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockActivity = {
  id: "770e8400-e29b-41d4-a716-446655440000",
  userId: mockUser.id,
  type: "DEPOSIT" as const,
  status: "COMPLETE" as const,
  description: "Test deposit",
  amount: 100.0,
  metadata: null,
  referenceId: null,
  ipAddress: "127.0.0.1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const validCreateUserBody = {
  clerkUserId: "user_test123",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phoneNumberPrefix: "+1",
  phoneNumber: "1234567890",
  dateOfBirth: "1990-01-01",
  nationality: "US",
};

export const validCreateAddressBody = {
  type: "PRESENT",
  addressLine1: "123 Main St",
  addressLine2: "Apt 4B",
  city: "New York",
  state: "New York",
  country: "US",
  postalCode: "10001",
};

export const validAdminCreateUserBody = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  phoneNumberPrefix: "+1",
  phoneNumber: "9876543210",
  dateOfBirth: "1995-05-15",
  nationality: "US",
};

export const validCreatePromoterBody = {
  firstName: "Promo",
  lastName: "User",
  email: "promo@example.com",
  phoneNumberPrefix: "+1",
  phoneNumber: "5555555555",
  dateOfBirth: "1992-03-20",
  nationality: "US",
  role: "PROMOTER",
  referValue: 5,
};

export const mockNotification = {
  id: "880e8400-e29b-41d4-a716-446655440000",
  userId: mockUser.id,
  type: "KYC_APPROVED" as const,
  title: "KYC Approved",
  body: "Your identity verification is complete.",
  metadata: null,
  isRead: false,
  readAt: null,
  created_at: new Date(),
};

export const mockReadNotification = {
  ...mockNotification,
  id: "880e8400-e29b-41d4-a716-446655440001",
  isRead: true,
  readAt: new Date(),
};

export const mockDevice = {
  id: "990e8400-e29b-41d4-a716-446655440000",
  userId: mockUser.id,
  platform: "IOS" as const,
  expoPushToken: "ExponentPushToken[test-token-123]",
  deviceName: "iPhone 15",
  lastActiveAt: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

export const validRegisterDeviceBody = {
  expoPushToken: "ExponentPushToken[test-token-123]",
  platform: "IOS",
  deviceName: "iPhone 15",
};

export const mockValidationResult = {
  validationStatus: "VALID" as const,
  validationGranularity: "PREMISE",
  addressComplete: true,
  formattedAddress: "123 Main St, Apt 4B, New York, NY 10001, USA",
};

export const mockValidationNeedsReview = {
  validationStatus: "NEEDS_REVIEW" as const,
  validationGranularity: "ROUTE",
  addressComplete: false,
  formattedAddress: "123 Main St, New York, NY 10001, USA",
  corrections: [
    { field: "subpremise", original: "(inferred)", corrected: "Apt 4B" },
  ],
};

export const mockValidationUnavailable = {
  validationStatus: "UNAVAILABLE" as const,
};

export const mockPlaceDetailsResult = {
  street: "123 Main St",
  city: "New York",
  state: "New York",
  postalCode: "10001",
  country: "US",
  formattedAddress: "123 Main St, New York, NY 10001, USA",
};

export const mockAutocompletePredictions = [
  {
    placeId: "ChIJOwg_06VPwokRYv534QaPC8g",
    description: "123 Main Street, New York, NY, USA",
    mainText: "123 Main Street",
    secondaryText: "New York, NY, USA",
  },
  {
    placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    description: "123 Main Avenue, Brooklyn, NY, USA",
    mainText: "123 Main Avenue",
    secondaryText: "Brooklyn, NY, USA",
  },
];
