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
