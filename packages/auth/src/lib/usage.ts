import { polarClient } from "./payments";

export interface ReportUsageParams {
	userId: string;
	periodStart: Date;
	periodEnd: Date;
	totalCount: number;
}

export interface ReportUsageResult {
	success: boolean;
	error?: string;
	inserted?: number;
}

/**
 * Reports redirect usage to Polar for billing purposes
 * @param params - Usage data to report
 * @returns Result indicating success/failure
 */
export async function reportUsageToPolar(
	params: ReportUsageParams,
): Promise<ReportUsageResult> {
	const { userId, periodStart, periodEnd, totalCount } = params;

	try {
		const result = await polarClient.events.ingest({
			events: [
				{
					name: "redirect",
					externalCustomerId: userId,
					timestamp: periodEnd,
					metadata: {
						period_start: periodStart.toISOString(),
						period_end: periodEnd.toISOString(),
						redirect_count: totalCount,
					},
				},
			],
		});

		return {
			success: true,
			inserted: result.inserted,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			error: errorMessage,
		};
	}
}
