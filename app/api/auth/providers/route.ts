import { NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getPocketBaseUrl, POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";

export async function GET(): Promise<NextResponse> {
  try {
    const pb = new PocketBase(getPocketBaseUrl());
    const methods = await pb.collection(POCKETBASE_USER_COLLECTION).listAuthMethods();
    const providers = methods.oauth2.providers.map((provider) => ({
      name: provider.name,
      displayName: provider.displayName,
    }));
    return NextResponse.json({ success: true, providers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch auth providers";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
