import { redirectCode } from "@rediredge/db/schema/domains";
import { z } from "zod";

export const redirectPayloadBaseSchema = z.object({
	id: z.uuid(),
	apex: z.string().min(1),
	subdomain: z.string().min(1),
	userId: z.string(),
	destinationUrl: z.url(),
	code: z.enum(redirectCode.enumValues),
	preservePath: z.boolean(),
	preserveQuery: z.boolean(),
	enabled: z.boolean(),
	version: z.number().int().positive(),
});

export const redirectCreatedPayloadSchema = redirectPayloadBaseSchema;

export const redirectUpdatedPayloadSchema = redirectPayloadBaseSchema.extend({
	oldApex: z.string().min(1),
	oldSubdomain: z.string().min(1),
});

export const redirectDeletedPayloadSchema = z.object({
	id: z.uuid(),
	apex: z.string().min(1),
	subdomain: z.string().min(1),
});

export const outboxEventSchema = z.discriminatedUnion("topic", [
	z.object({
		topic: z.literal("redirect.created"),
		payload: redirectCreatedPayloadSchema,
	}),
	z.object({
		topic: z.literal("redirect.updated"),
		payload: redirectUpdatedPayloadSchema,
	}),
	z.object({
		topic: z.literal("redirect.deleted"),
		payload: redirectDeletedPayloadSchema,
	}),
]);

export type RedirectCreatedPayload = z.infer<
	typeof redirectCreatedPayloadSchema
>;
export type RedirectUpdatedPayload = z.infer<
	typeof redirectUpdatedPayloadSchema
>;
export type RedirectDeletedPayload = z.infer<
	typeof redirectDeletedPayloadSchema
>;
export type OutboxEvent = z.infer<typeof outboxEventSchema>;
