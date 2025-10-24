import { auth } from "@rediredge/auth";
import { db, eq } from "@rediredge/db";
import { domain, redirect } from "@rediredge/db/schema/domains";
import { headers } from "next/headers";
import { redirect as nextRedirect } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default async function DashboardPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) throw new Error();

	const domains = await db
		.select()
		.from(domain)
		.leftJoin(redirect, eq(redirect.domainId, domain.id))
		.where(eq(domain.userId, session.user.id));

	if (!domains.length || !domains.find((d) => d.redirect?.id))
		return nextRedirect("/p/new");

	const { data: customerState } = await authClient.customer.state({
		fetchOptions: { headers: await headers() },
	});

	return <div>{JSON.stringify(domains)}</div>;
}
