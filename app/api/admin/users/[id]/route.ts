import { NextRequest, NextResponse } from "next/server";
import {
  POCKETBASE_COMPLAINTS_COLLECTION,
  POCKETBASE_USAGE_EVENTS_COLLECTION,
  POCKETBASE_USER_COLLECTION,
} from "@/lib/pocketbase/config";
import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { logAdminAuditFromSession } from "@/lib/pocketbase/audit";
import { escapeFilterValue } from "@/lib/pocketbase/filters";
import { hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";
import {
  normalizePocketBaseUser,
  normalizeSessionVersion,
  type PocketBaseUserRecord,
} from "@/lib/pocketbase/users";

const MANAGE_USER_ROLES = new Set(["super_admin", "support_admin"]);
const ALLOWED_STATUSES = new Set(["active", "suspended", "disabled"]);
const ALLOWED_ROLES = new Set(["user", "read_only", "support_agent", "support_admin", "super_admin"]);
const SUPPORT_ADMIN_ASSIGNABLE_ROLES = new Set(["user", "read_only", "support_agent"]);

function canManageUsers(role: string): boolean {
  return MANAGE_USER_ROLES.has(role);
}

function isProtectedAdminRole(role: string): boolean {
  return role === "support_admin" || role === "super_admin";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const { id } = await params;
    const pb = await createPocketBaseAdminClient();
    const record = (await pb.collection(POCKETBASE_USER_COLLECTION).getOne(id, {
      requestKey: null,
    })) as PocketBaseUserRecord;

    const [complaints, openComplaints, usage] = await Promise.all([
      pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getList(1, 5, {
        filter: `user = "${escapeFilterValue(id)}"`,
        sort: "-created",
        skipTotal: false,
        requestKey: null,
      }),
      pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getList(1, 1, {
        filter: `user = "${escapeFilterValue(id)}" && (status = "new" || status = "triaged" || status = "investigating" || status = "waiting_user")`,
        skipTotal: false,
        requestKey: null,
      }),
      pb.collection(POCKETBASE_USAGE_EVENTS_COLLECTION).getList(1, 8, {
        filter: `user = "${escapeFilterValue(id)}"`,
        sort: "-created",
        skipTotal: false,
        requestKey: null,
      }),
    ]);
    const recentComplaints = await hydrateUserExpansions(pb, complaints.items, ["assignee"]);

    return NextResponse.json({
      success: true,
      item: record,
      recentComplaints,
      recentUsage: usage.items,
      summary: {
        totalComplaints: complaints.totalItems,
        openComplaints: openComplaints.totalItems,
        totalUsageEvents: usage.totalItems,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();
  if (!canManageUsers(session.role)) return forbiddenResponse("You cannot manage user accounts.");

  try {
    const body = (await request.json()) as {
      role?: string;
      status?: string;
      name?: string;
      fullName?: string;
      forceSignOut?: boolean;
      reason?: string;
    };

    const { id } = await params;
    const pb = await createPocketBaseAdminClient();
    const currentRecord = (await pb.collection(POCKETBASE_USER_COLLECTION).getOne(id, {
      requestKey: null,
    })) as PocketBaseUserRecord;
    const currentUser = normalizePocketBaseUser(currentRecord);
    const currentName =
      typeof currentRecord.name === "string"
        ? currentRecord.name
        : typeof currentRecord.fullName === "string"
          ? currentRecord.fullName
          : "";
    const currentFullName = typeof currentRecord.fullName === "string" ? currentRecord.fullName : "";
    const isSelf = session.userId === id;

    if (session.role !== "super_admin") {
      if (isProtectedAdminRole(currentUser.role)) {
        return forbiddenResponse("Support admins cannot modify protected admin accounts.");
      }
      if (body.role && !SUPPORT_ADMIN_ASSIGNABLE_ROLES.has(body.role)) {
        return forbiddenResponse("Support admins cannot assign elevated admin roles.");
      }
    }

    if (isSelf) {
      if (body.forceSignOut) {
        return NextResponse.json(
          { success: false, error: "Use the normal logout flow instead of force sign-out on your own account." },
          { status: 400 },
        );
      }
      if (body.role && body.role !== currentUser.role) {
        return NextResponse.json(
          { success: false, error: "You cannot change your own admin role from this screen." },
          { status: 400 },
        );
      }
      if (body.status && body.status !== "active") {
        return NextResponse.json(
          { success: false, error: "You cannot suspend or disable your own admin account from this screen." },
          { status: 400 },
        );
      }
    }

    const patch: Record<string, string | number> = {};

    if (typeof body.role === "string" && body.role !== currentUser.role) {
      if (!ALLOWED_ROLES.has(body.role)) {
        return NextResponse.json({ success: false, error: "Invalid role." }, { status: 400 });
      }
      patch.role = body.role;
    }

    if (typeof body.status === "string" && body.status !== currentUser.status) {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
      }
      patch.status = body.status;
    }

    if (typeof body.name === "string") {
      const nextName = body.name.trim();
      if (nextName !== currentName) {
        patch.name = nextName;
      }
    }

    if (typeof body.fullName === "string") {
      const nextFullName = body.fullName.trim();
      if (nextFullName !== currentFullName) {
        patch.fullName = nextFullName;
      }
    }

    const shouldRotateSession = body.forceSignOut === true || patch.status === "suspended" || patch.status === "disabled";
    if (shouldRotateSession) {
      patch.sessionVersion = normalizeSessionVersion(currentRecord.sessionVersion) + 1;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: "No updates supplied." }, { status: 400 });
    }

    const updated = await pb.collection(POCKETBASE_USER_COLLECTION).update(id, patch, {
      requestKey: null,
    });

    const reason = body.reason?.trim() || undefined;
    const auditAction =
      body.forceSignOut === true && Object.keys(patch).every((key) => key === "sessionVersion")
        ? "user.force_sign_out"
        : patch.status === "suspended" || patch.status === "disabled"
          ? "user.account_intervention"
          : "user.update";

    await logAdminAuditFromSession(
      session,
      auditAction,
      "user",
      id,
      {
        ...patch,
        previousRole: currentUser.role,
        previousStatus: currentUser.status,
        previousSessionVersion: normalizeSessionVersion(currentRecord.sessionVersion),
      },
      reason,
    );

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
