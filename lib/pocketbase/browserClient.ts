"use client";

import PocketBase from "pocketbase";
import { getPocketBasePublicUrl } from "@/lib/pocketbase/config";

let browserClient: PocketBase | null = null;

export function getPocketBaseBrowserClient(): PocketBase {
  if (!browserClient) {
    browserClient = new PocketBase(getPocketBasePublicUrl());
    browserClient.autoCancellation(false);
  }
  return browserClient;
}
