import PocketBase from "pocketbase";
import { escapeFilterValue } from "@/lib/pocketbase/filters";
import { AppSession } from "@/lib/pocketbase/session";

export type BusinessRole = "owner" | "admin" | "accountant" | "staff" | "auditor" | "viewer";

const WRITE_ROLES = new Set<BusinessRole>(["owner", "admin", "accountant"]);

type BusinessRecord = {
  id: string;
  owner?: string;
  [key: string]: unknown;
};

type BusinessMemberRecord = {
  id: string;
  business?: string;
  user?: string;
  role?: BusinessRole;
  status?: string;
  [key: string]: unknown;
};

export type BusinessAccess = {
  business: BusinessRecord;
  membership: BusinessMemberRecord | null;
  role: BusinessRole;
  canWrite: boolean;
};

export async function getBusinessAccess(
  pb: PocketBase,
  session: AppSession,
  businessId: string,
): Promise<BusinessAccess | null> {
  const business = (await pb.collection("businesses").getOne(businessId, {
    requestKey: null,
  })) as BusinessRecord;

  if (business.owner === session.userId) {
    return {
      business,
      membership: null,
      role: "owner",
      canWrite: true,
    };
  }

  let membership: BusinessMemberRecord | null = null;
  try {
    membership = (await pb.collection("business_members").getFirstListItem(
      `business="${escapeFilterValue(businessId)}" && user="${escapeFilterValue(session.userId)}" && status="active"`,
      { requestKey: null },
    )) as BusinessMemberRecord;
  } catch {
    membership = null;
  }

  if (!membership?.role) {
    return null;
  }

  return {
    business,
    membership,
    role: membership.role,
    canWrite: WRITE_ROLES.has(membership.role),
  };
}

export async function requireBusinessWriteAccess(
  pb: PocketBase,
  session: AppSession,
  businessId: string,
): Promise<BusinessAccess> {
  const access = await getBusinessAccess(pb, session, businessId);
  if (!access) {
    throw new Error("You do not have access to this business.");
  }
  if (!access.canWrite) {
    throw new Error("You do not have permission to modify this business.");
  }
  return access;
}
