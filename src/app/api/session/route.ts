import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  createSessionCookie,
  setSessionCookie,
} from "@/lib/session";

export async function POST(req: NextRequest) {
  const { idToken } = (await req.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }
  try {
    const cookie = await createSessionCookie(idToken);
    await setSessionCookie(cookie);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unauthorized" },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
