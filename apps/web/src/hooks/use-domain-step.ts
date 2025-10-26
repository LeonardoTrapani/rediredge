import type { AppRouter } from "@rediredge/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";

export enum Step {
	Domain = 0,
	Verification = 1,
	Redirects = 2,
}

export type DomainWithRedirects =
	inferRouterOutputs<AppRouter>["getDomainWithRedirects"];

const getStepBasedOnDomainWithRedirects = (
	domainWithRedirects?: DomainWithRedirects,
) => {
	if (!domainWithRedirects) {
		return Step.Domain;
	}
	if (domainWithRedirects.verified) {
		return Step.Redirects;
	}
	return Step.Verification;
};

export const useDomainStep = (domainWithRedirects?: DomainWithRedirects) => {
	const [step, setStep] = useState<Step>(
		getStepBasedOnDomainWithRedirects(domainWithRedirects),
	);

	useEffect(
		() => setStep(getStepBasedOnDomainWithRedirects(domainWithRedirects)),
		[domainWithRedirects],
	);

	return { step };
};
