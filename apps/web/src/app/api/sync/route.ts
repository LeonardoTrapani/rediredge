import { start } from "workflow/api";
import { syncOutboxWorkflow } from "@/workflows/sync-outbox";

export async function POST() {
	const run = await start(syncOutboxWorkflow, []);
	return Response.json({ ok: true, runId: run.runId });
}
