import { auth } from "@rediredge/auth";
import { count, db, eq, sql } from "@rediredge/db";
import { domain, redirect } from "@rediredge/db/schema/domains";
import { headers } from "next/headers";
import { redirect as nextRedirect } from "next/navigation";
import DashboardClient from "./_dashboard-client";

export default async function DashboardPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) throw new Error();

	const domains = await db
		.select({
			id: domain.id,
			apex: domain.apex,
			verified: domain.verified,
			verifiedAt: domain.verifiedAt,
			totalRedirects: count(redirect.id),
			activeRedirects: sql<number>`count(case when ${redirect.enabled} = true then 1 end)`,
		})
		.from(domain)
		.leftJoin(redirect, eq(redirect.domainId, domain.id))
		.where(eq(domain.userId, session.user.id))
		.groupBy(domain.id);

	if (!domains.length) return nextRedirect("/p/new");

	return <DashboardClient domains={domains} />;
}
