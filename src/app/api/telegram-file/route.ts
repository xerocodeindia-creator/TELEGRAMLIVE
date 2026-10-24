import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function proxyImageResponse(response: Response) {
  const upstreamType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!upstreamType.startsWith("image/")) return null;
  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": upstreamType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get("file_id");
  if (!fileId || fileId.length > 2048) {
    return NextResponse.json({ error: "A valid Telegram file_id is required" }, { status: 400 });
  }

  // Prefer n8n's saved Telegram credential. This prevents a second, potentially stale
  // bot token in Vercel from being used for file IDs created by the live bot.
  const n8nBaseUrl = process.env.N8N_BASE_URL?.replace(/\/+$/, "");
  const proxySecret = process.env.N8N_TELEGRAM_IMAGE_PROXY_SECRET;
  if (n8nBaseUrl && proxySecret) {
    try {
      const response = await fetch(`${n8nBaseUrl}/webhook/telegram-image-proxy-${proxySecret}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "image/*",
        },
        body: JSON.stringify({ file_id: fileId }),
        cache: "no-store",
      });
      if (response.ok) {
        const image = proxyImageResponse(response);
        if (image) return image;
        const detail = (await response.text().catch(() => "")).slice(0, 160);
        return NextResponse.json(
          { error: "The n8n image proxy did not return image data", detail },
          { status: 502, headers: { "Cache-Control": "private, no-store" } }
        );
      }
      return NextResponse.json(
        { error: `The n8n image proxy returned HTTP ${response.status}` },
        { status: 502, headers: { "Cache-Control": "private, no-store" } }
      );
    } catch {
      return NextResponse.json(
        { error: "Unable to reach the n8n Telegram image proxy" },
        { status: 502, headers: { "Cache-Control": "private, no-store" } }
      );
    }
  }

  // Temporary backward-compatible fallback until the proxy secret is configured.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Telegram image proxy is not configured on the server" },
      { status: 503 }
    );
  }

  try {
    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, { cache: "no-store" });
    const filePayload = await fileResponse.json();
    const filePath = filePayload?.result?.file_path;
    if (!fileResponse.ok || !filePayload?.ok || typeof filePath !== "string") {
      return NextResponse.json(
        { error: "Telegram could not resolve this image file using the configured bot token" },
        { status: 502 }
      );
    }

    const imageResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, { cache: "no-store" });
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Unable to download image from Telegram" }, { status: 502 });
    }

    const image = proxyImageResponse(imageResponse);
    if (image) return image;

    const extension = filePath.toLowerCase().split(".").pop() || "";
    const inferredType: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    return new NextResponse(imageResponse.body, {
      status: 200,
      headers: {
        "Content-Type": inferredType[extension] || "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Telegram image fetch failed" }, { status: 502 });
  }
}
