import { NextResponse } from "next/server";
import { processUsageBatch } from "@/lib/usage-worker";

export async function GET(request: Request) {
	// Verify cron secret
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Process usage batch
	const result = await processUsageBatch();

	return NextResponse.json({
		processed: result.processed,
		failed: result.failed,
		errors: result.errors,
	});
}
