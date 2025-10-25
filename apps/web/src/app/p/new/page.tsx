"use client";

import { redirectCode } from "@rediredge/db/schema/domains";
import { useForm } from "@tanstack/react-form";
import { Plus } from "lucide-react";
import { Activity, useId, useState } from "react";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

enum Step {
	Domain = 0,
	Redirects = 1,
	Validate = 2,
	Submit = 3,
}

const labelRE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i; // RFC-style host label
const tldRE = /^[a-z]{2,63}$/i; // TLD: letters only (IDNs via punycode allowed)

const bareDomainSchema = z
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

		if (totalLen > 253 || !labelRE.test(sld) || !tldRE.test(tld)) {
			ctx.addIssue({
				code: "custom",
				message: "Must be a valid domain (e.g. example.com).",
			});
		}
	});

const redirectSchema = z.object({
	desinationUrl: z.url(),
	code: z.enum(redirectCode.enumValues),
	preservePath: z.boolean(),
	preserveQuery: z.boolean(),
});

const defaultRedirect = {
	code: "308",
	desinationUrl: "",
	preservePath: true,
	preserveQuery: true,
} as const;

export default function NewPage() {
	const [step, setStep] = useState<Step>(Step.Domain);
	const id = useId();

	const form = useForm({
		defaultValues: {
			domain: "",
			redirects: [defaultRedirect],
		},
		onSubmit: async ({ value }) => {
			if (step < Step.Submit) {
				return setStep((prev) => prev + 1);
			}

			console.log("submitted", value);
		},
	});

	return (
		<div className="mx-auto w-full max-w-xl">
			<form
				id={id}
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="mt-44"
			>
				<FieldGroup>
					<Activity mode={step >= Step.Domain ? "visible" : "hidden"}>
						<form.Field
							name="domain"
							validators={{
								onChange: bareDomainSchema,
							}}
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={id}>Domain</FieldLabel>
										<Input
											id={id}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="example.com"
										/>
										<FieldDescription>
											The domain you want to redirect
										</FieldDescription>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
					</Activity>
					<Activity mode={step >= Step.Redirects ? "visible" : "hidden"}>
						dfkja
					</Activity>
				</FieldGroup>
				<Field orientation="horizontal" className="mt-6">
					{step === Step.Redirects && (
						<Button
							variant="outline"
							type="button"
							onClick={() => {
								form.setFieldValue("redirects", [
									...(form.getFieldValue("redirects") || []),
									defaultRedirect,
								]);
							}}
						>
							<Plus />
							Add Redirect
						</Button>
					)}
					<Button type="submit" form={id}>
						Submit
					</Button>
				</Field>
			</form>
		</div>
	);
}
