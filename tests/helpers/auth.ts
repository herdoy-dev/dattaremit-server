import { verifyToken } from "@clerk/express";
import { mockUser, mockAdminUser, mockActiveUser } from "./mock-data";

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

export function mockAuthAsUser() {
  mockVerifyToken.mockResolvedValue({ sub: mockUser.clerkUserId } as any);
}

export function mockAuthAsAdmin() {
  mockVerifyToken.mockResolvedValue({ sub: mockAdminUser.clerkUserId } as any);
}

export function mockAuthAsActiveUser() {
  mockVerifyToken.mockResolvedValue({ sub: mockActiveUser.clerkUserId } as any);
}

export function mockAuthFailure() {
  mockVerifyToken.mockRejectedValue(new Error("Invalid token"));
}

export const AUTH_TOKEN = "test-auth-token";
