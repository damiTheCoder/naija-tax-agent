import type PocketBase from "pocketbase";
import { POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { escapeFilterValue } from "@/lib/pocketbase/filters";
import { normalizePocketBaseUser, type PocketBaseUserRecord } from "@/lib/pocketbase/users";

type ExpandableRecord = {
  expand?: Record<string, unknown>;
  [key: string]: unknown;
};

type PublicUserExpand = ReturnType<typeof normalizePocketBaseUser> & {
  fullName?: string;
  created?: string;
  updated?: string;
};

function getRelationIds(value: unknown): string[] {
  if (typeof value === "string" && value) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  return [];
}

function toPublicUserExpand(record: PocketBaseUserRecord): PublicUserExpand {
  const user = normalizePocketBaseUser(record);

  return {
    ...user,
    fullName: typeof record.fullName === "string" ? record.fullName : undefined,
    created: typeof record.created === "string" ? record.created : undefined,
    updated: typeof record.updated === "string" ? record.updated : undefined,
  };
}

async function getUserMap(pb: PocketBase, userIds: string[]): Promise<Map<string, PublicUserExpand>> {
  if (userIds.length === 0) {
    return new Map<string, PublicUserExpand>();
  }

  const filter = userIds.map((id) => `id = "${escapeFilterValue(id)}"`).join(" || ");
  const users = (await pb.collection(POCKETBASE_USER_COLLECTION).getFullList({
    filter,
    fields: "id,email,name,fullName,role,status,sessionVersion,created,updated",
    requestKey: null,
  })) as PocketBaseUserRecord[];

  return new Map(users.map((record) => [record.id, toPublicUserExpand(record)]));
}

export async function hydrateUserExpansions<T extends ExpandableRecord>(
  pb: PocketBase,
  items: T[],
  relationKeys: string[],
): Promise<T[]> {
  const userIds = new Set<string>();

  for (const item of items) {
    for (const key of relationKeys) {
      for (const id of getRelationIds(item[key])) {
        userIds.add(id);
      }
    }
  }

  if (userIds.size === 0) {
    return items;
  }

  const userMap = await getUserMap(pb, [...userIds]);

  return items.map((item) => {
    const expand: Record<string, unknown> = { ...(item.expand || {}) };
    let changed = false;

    for (const key of relationKeys) {
      const relationIds = getRelationIds(item[key]);
      if (relationIds.length === 0) {
        continue;
      }

      if (Array.isArray(item[key])) {
        const relatedUsers = relationIds
          .map((id) => userMap.get(id))
          .filter((value): value is PublicUserExpand => Boolean(value));

        if (relatedUsers.length > 0) {
          expand[key] = relatedUsers;
          changed = true;
        }
        continue;
      }

      const relatedUser = userMap.get(relationIds[0]);
      if (relatedUser) {
        expand[key] = relatedUser;
        changed = true;
      }
    }

    return changed ? { ...item, expand } : item;
  });
}

export async function hydrateUserExpansion<T extends ExpandableRecord>(
  pb: PocketBase,
  item: T,
  relationKeys: string[],
): Promise<T> {
  const [hydrated] = await hydrateUserExpansions(pb, [item], relationKeys);
  return hydrated;
}
