import { headers } from "next/headers";
import { authClient } from "@/lib/auth-client";
import DomainPage from "./_domainPage";

export default async function Page({
	params,
}: {
	params: Promise<{ apex: string }>;
}) {
	const { apex } = await params;

	const { data: customerState } = await authClient.customer.state({
		fetchOptions: {
			headers: await headers(),
		},
	});

	const hasProSubscription =
		customerState?.activeSubscriptions &&
		customerState?.activeSubscriptions?.length > 0;

	return <DomainPage apex={apex} hasActiveSubscription={hasProSubscription} />;
}
