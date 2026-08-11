import { captureBrowserFrame } from "@/lib/apply/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("sessionId") || "";
  const frame = id ? await captureBrowserFrame(id) : null;
  if (!frame) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(frame), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store, max-age=0",
      "Content-Length": String(frame.byteLength),
    },
  });
}
