import { polarClient } from "./payments";

export interface ReportUsageParams {
	userId: string;
	timestamp: Date;
	count: number;
	redirectId: string;
}

export interface ReportUsageResult {
	inserted: number;
}

/**
 * Reports redirect usage to Polar for billing purposes
 * @param params - Usage data to report
 * @returns Result indicating success/failure
 */
export async function reportUsageToPolar(
	params: ReportUsageParams,
): Promise<ReportUsageResult> {
	const result = await polarClient.events.ingest({
		events: [
			{
				name: "redirect",
				externalCustomerId: params.userId,
				timestamp: params.timestamp,
				metadata: {
					redirect_count: params.count,
					redirect_id: params.redirectId,
				},
			},
		],
	});

	return {
		inserted: result.inserted,
	};
}
