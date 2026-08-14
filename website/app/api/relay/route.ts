import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const started = Date.now();
  const body = await request.json();
  const required = ["eventId", "routeKey", "branchId", "ciphertext"];
  const missing = required.filter((key) => !body?.[key]);
  if (missing.length)
    return NextResponse.json({ error: `missing:${missing.join(",")}` }, { status: 400 });

  // Deliberately content-blind. Do not decode, inspect, log or persist ciphertext.
  if (body.failOnce) await new Promise((resolve) => setTimeout(resolve, 420));
  await new Promise((resolve) => setTimeout(resolve, 110));

  return NextResponse.json({
    accepted: true,
    eventId: body.eventId,
    routeKey: body.routeKey,
    receipt: `WEMA-DEMO-${Math.floor(10000 + Math.random() * 89999)}`,
    retried: Boolean(body.failOnce),
    attempts: body.failOnce ? 2 : 1,
    latencyMs: Date.now() - started,
    plaintextVisibleToCorri: false,
  });
}
