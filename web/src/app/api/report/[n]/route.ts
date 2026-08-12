import { NextResponse } from "next/server";
import { readReport } from "@/lib/career-ops";
import { parseReport } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Client-readable report body for Activity OUTPUT showcase (evaluate jobs). */
export async function GET(_req: Request, ctx: { params: Promise<{ n: string }> }) {
  const { n } = await ctx.params;
  const id = String(n || "").trim();
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "invalid report number" }, { status: 400 });
  }
  const data = readReport(id);
  if (!data) {
    return NextResponse.json({ error: "report not found" }, { status: 404 });
  }
  const meta = parseReport(data.content);
  return NextResponse.json({
    content: data.content,
    file: data.file,
    meta: {
      title: meta.title,
      legitimacy: meta.legitimacy,
      fields: meta.fields,
    },
  });
}
