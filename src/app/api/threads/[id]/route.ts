/** GET /api/threads/[id] — chat history for the copilot panel. */
import { NextResponse } from "next/server";
import { getChatThread } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await getChatThread(id);
  return NextResponse.json({ messages });
}
