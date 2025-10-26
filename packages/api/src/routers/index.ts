import { publicProcedure, router } from "../index";
import { domainRouter } from "./domain.router";
import { redirectRouter } from "./redirect.router";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	domain: domainRouter,
	redirect: redirectRouter,
});

export type AppRouter = typeof appRouter;
