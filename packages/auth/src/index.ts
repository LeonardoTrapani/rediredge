import { checkout, polar, portal } from "@polar-sh/better-auth";
import { db } from "@rediredge/db";
import * as schema from "@rediredge/db/schema/auth";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { polarClient } from "./lib/payments";

const options = {
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	trustedOrigins: [process.env.CORS_ORIGIN || ""],
	emailAndPassword: {
		enabled: true,
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	plugins: [
		polar({
			client: polarClient,
			createCustomerOnSignUp: true,
			enableCustomerPortal: true,
			use: [
				checkout({
					products: [
						{
							productId: process.env.POLAR_PRODUCT_ID || "your-product-id",
							slug: "pro",
						},
					],
					successUrl: process.env.POLAR_SUCCESS_URL,
					authenticatedUsersOnly: true,
				}),
				portal(),
			],
		}),
		nextCookies(),
	],
} satisfies BetterAuthOptions;

export const auth: ReturnType<typeof betterAuth> = betterAuth(options);

export { polarClient } from "./lib/payments";

export async function checkActiveSubscription(userId: string) {
	try {
		const customerState = await polarClient.customers.getStateExternal({
			externalId: userId,
		});
		return customerState.activeSubscriptions.length > 0;
	} catch (error) {
		// If customer doesn't exist in Polar yet, they don't have a subscription
		if (
			error &&
			typeof error === "object" &&
			"status" in error &&
			error.status === 404
		) {
			return false;
		}
		throw error;
	}
}
