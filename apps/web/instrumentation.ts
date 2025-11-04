import { start } from "workflow/api";
import { syncOutboxWorkflow } from "@/workflows/sync-outbox";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await start(syncOutboxWorkflow, []).catch(console.error);
		console.log("syncOutboxWorkflow started on server boot");
	}
}
