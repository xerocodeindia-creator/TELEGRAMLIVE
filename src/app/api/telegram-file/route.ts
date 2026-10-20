import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get("file_id");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Telegram bot token is not configured on the server" }, { status: 503 });
  }
  if (!fileId || fileId.length > 2048) {
    return NextResponse.json({ error: "A valid Telegram file_id is required" }, { status: 400 });
  }

  try {
    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, { cache: "no-store" });
    const filePayload = await fileResponse.json();
    const filePath = filePayload?.result?.file_path;
    if (!fileResponse.ok || !filePayload?.ok || typeof filePath !== "string") {
      return NextResponse.json({ error: "Telegram could not resolve this image file" }, { status: 502 });
    }

    const imageResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, { cache: "no-store" });
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Unable to download image from Telegram" }, { status: 502 });
    }

    const upstreamType = (imageResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const extension = filePath.toLowerCase().split(".").pop() || "";
    const inferredType: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    // Telegram/CDN responses can omit or genericize content-type; infer from Telegram's file path.
    const contentType = upstreamType.startsWith("image/") ? upstreamType : (inferredType[extension] || "image/jpeg");

    return new NextResponse(imageResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Telegram image fetch failed" }, { status: 502 });
  }
}
