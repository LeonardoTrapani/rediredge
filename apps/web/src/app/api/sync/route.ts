import { NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/outbox";

export async function GET(request: Request) {
	// Verify cron secret
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Process outbox batch
	const result = await processOutboxBatch();

	return NextResponse.json({
		processed: result.processed,
		failed: result.failed,
	});
}
