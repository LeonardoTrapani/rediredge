"use client";

import { useQuery } from "@tanstack/react-query";
import { DomainForm } from "@/components/domain-form";
import { trpc } from "@/utils/trpc";

export default function DomainPage({
	apex,
	hasActiveSubscription,
}: {
	apex: string;
	hasActiveSubscription?: boolean;
}) {
	const query = useQuery(trpc.domain.getWithRedirects.queryOptions({ apex }));

	return (
		<DomainForm
			domainWithRedirects={query.data}
			isPending={query.isLoading}
			error={query.error}
			hasActiveSubscription={hasActiveSubscription}
		/>
	);
}
