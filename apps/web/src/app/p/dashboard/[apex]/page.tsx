"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { DomainForm } from "@/components/domain-form";
import { trpc } from "@/utils/trpc";

export default function DomainPage({
	params,
}: {
	params: Promise<{ apex: string }>;
}) {
	const { apex } = use(params);
	const query = useQuery(trpc.getDomainWithRedirects.queryOptions({ apex }));

	return (
		<DomainForm domainWithRedirects={query.data} isPending={query.isLoading} />
	);
}
