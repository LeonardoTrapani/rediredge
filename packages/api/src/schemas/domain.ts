import { redirectCode } from "@rediredge/db/schema/domains";
import { z } from "zod";

const labelRE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const tldRE = /^[a-z]{2,63}$/i;

export const bareDomainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.superRefine((value, ctx) => {
		if (!/^[a-z0-9.-]+$/.test(value)) {
			ctx.addIssue({
				code: "custom",
				message: "Must be a valid domain (e.g. example.com).",
			});
			return;
		}

		const parts = value.split(".");
		const totalLen = value.length;

		if (parts.length < 2) {
			ctx.addIssue({
				code: "custom",
				message: "Must be a valid domain (e.g. example.com).",
			});
			return;
		}

		if (parts.length > 2) {
			ctx.addIssue({
				code: "custom",
				message:
					"Subdomains are not allowed; use the base domain only (e.g., example.com).",
			});
			return;
		}

		const [sld, tld] = parts;

		if (
			totalLen > 253 ||
			!sld ||
			!tld ||
			!labelRE.test(sld) ||
			!tldRE.test(tld)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Must be a valid domain (e.g. example.com).",
			});
		}
	});

export const redirectSchema = z.object({
	subdomain: z.string().min(1),
	destinationUrl: z.url("Must be a valid URL"),
	code: z.enum(redirectCode.enumValues),
	preservePath: z.boolean(),
	preserveQuery: z.boolean(),
});

export const createDomainSchema = z.object({
	domain: bareDomainSchema,
});

export const getDomainSchema = z.object({
	apex: bareDomainSchema,
});
