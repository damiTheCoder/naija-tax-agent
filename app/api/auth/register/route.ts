import { NextRequest, NextResponse } from "next/server";
import { getPocketBaseUrl, POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { normalizePocketBaseUser, type PocketBaseUserRecord } from "@/lib/pocketbase/users";
import PocketBase from "pocketbase";

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Registration failed";
  const response = (error as Error & { response?: { message?: string; data?: Record<string, { message?: string }> } }).response;
  const fieldMessages = response?.data
    ? Object.values(response.data)
        .map((item) => item?.message)
        .filter(Boolean)
    : [];
  return fieldMessages[0] || response?.message || error.message || "Registration failed";
}

async function createUserRecord(payload: RegisterPayload): Promise<void> {
  const richPayload = {
    ...payload,
    full_name: payload.name,
    role: "user",
    platform_role: "user",
    status: "active",
    onboarding_completed: false,
    sessionVersion: 1,
    verified: true,
  };

  const minimalPayload = {
    email: payload.email,
    password: payload.password,
    passwordConfirm: payload.passwordConfirm,
    name: payload.name,
  };

  try {
    const adminPb = await createPocketBaseAdminClient();
    try {
      await adminPb.collection(POCKETBASE_USER_COLLECTION).create(richPayload);
      return;
    } catch {
      await adminPb.collection(POCKETBASE_USER_COLLECTION).create(minimalPayload);
      return;
    }
  } catch {
    const pb = new PocketBase(getPocketBaseUrl());
    await pb.collection(POCKETBASE_USER_COLLECTION).create(minimalPayload);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      passwordConfirm?: string;
    };

    const name = body.name?.trim() || "";
    const email = body.email?.trim() || "";
    const password = body.password || "";
    const passwordConfirm = body.passwordConfirm || "";

    if (!name || !email || !password || !passwordConfirm) {
      return NextResponse.json(
        { success: false, error: "Name, email, password, and password confirmation are required." },
        { status: 400 },
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { success: false, error: "Password confirmation does not match." },
        { status: 400 },
      );
    }

    await createUserRecord({
      name,
      email,
      password,
      passwordConfirm,
    });

    let user = {
      id: "",
      email,
      name,
      role: "user",
      status: "active",
      sessionVersion: 1,
    };

    try {
      const pb = new PocketBase(getPocketBaseUrl());
      const record = (await pb
        .collection(POCKETBASE_USER_COLLECTION)
        .getFirstListItem(`email="${email.replace(/"/g, '\\"')}"`)) as PocketBaseUserRecord;
      user = normalizePocketBaseUser(record);
    } catch {
      // Account creation succeeded; login will fetch the fresh user record.
    }

    return NextResponse.json({
      success: true,
      user,
      requiresLogin: true,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
