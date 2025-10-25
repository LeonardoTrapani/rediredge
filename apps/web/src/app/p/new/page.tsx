"use client";

import { redirectCode } from "@rediredge/db/schema/domains";
import { useForm } from "@tanstack/react-form";
import { Plus } from "lucide-react";
import { Activity, useId, useState } from "react";
import z from "zod";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const subdomainSchema = z.string();
const destinationUrlSchema = z.url("Must be a valid URL");
const redirectCodeSchema = z.enum(redirectCode.enumValues);
const preservePathSchema = z.boolean();
const preserveQuerySchema = z.boolean();

const _redirectSchema = z.object({
	id: z.string(),
	subdomain: subdomainSchema,
	desinationUrl: destinationUrlSchema,
	code: redirectCodeSchema,
	preservePath: preservePathSchema,
	preserveQuery: preserveQuerySchema,
});

const createDefaultRedirect = () => ({
	id: crypto.randomUUID(),
	subdomain: "",
	code: "308" as const,
	desinationUrl: "",
	preservePath: true,
	preserveQuery: true,
});

export default function NewPage() {
	const [step, setStep] = useState<Step>(Step.Domain);
	const id = useId();

	const form = useForm({
		defaultValues: {
			domain: "",
			redirects: [createDefaultRedirect()],
			txtValidated: false,
			acmeValidated: false,
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
								onSubmit: bareDomainSchema,
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
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
					</Activity>
					<Activity mode={step >= Step.Redirects ? "visible" : "hidden"}>
						<form.Field name="redirects" mode="array">
							{(field) => (
								<div className="space-y-4">
									{field.state.value.map((redirect, index) => (
										<div key={redirect.id} className="flex gap-4">
											<form.Field
												name={`redirects[${index}].subdomain`}
												validators={{
													onSubmit: subdomainSchema,
												}}
											>
												{(subField) => (
													<Field className="flex-1">
														<FieldLabel>Subdomain</FieldLabel>
														<ButtonGroup>
															<ButtonGroupText asChild>
																<Label htmlFor={`subdomain-${redirect.id}`}>
																	https://
																</Label>
															</ButtonGroupText>
															<Input
																id={`subdomain-${redirect.id}`}
																value={subField.state.value}
																onChange={(e) =>
																	subField.handleChange(e.target.value)
																}
																onBlur={subField.handleBlur}
																placeholder="cal (optional)"
															/>
															<ButtonGroupText asChild>
																<Label htmlFor={`subdomain-${redirect.id}`}>
																	.leotrapani.com
																</Label>
															</ButtonGroupText>
														</ButtonGroup>
													</Field>
												)}
											</form.Field>
											<form.Field
												name={`redirects[${index}].desinationUrl`}
												validators={{
													onSubmit: destinationUrlSchema,
												}}
											>
												{(destField) => {
													const isInvalid =
														destField.state.meta.isTouched &&
														!destField.state.meta.isValid;

													return (
														<Field className="flex-1" data-invalid={isInvalid}>
															<FieldLabel>Destination URL</FieldLabel>
															<Input
																value={destField.state.value}
																onChange={(e) =>
																	destField.handleChange(e.target.value)
																}
																onBlur={destField.handleBlur}
																placeholder="https://cal.com/"
																aria-invalid={isInvalid}
															/>
															{isInvalid && (
																<FieldError
																	errors={destField.state.meta.errors}
																/>
															)}
														</Field>
													);
												}}
											</form.Field>
										</div>
									))}
								</div>
							)}
						</form.Field>
					</Activity>
				</FieldGroup>
				<Field orientation="horizontal" className="mt-8">
					{step === Step.Redirects && (
						<Button
							variant="outline"
							type="button"
							onClick={() => {
								form.setFieldValue("redirects", [
									...(form.getFieldValue("redirects") || []),
									createDefaultRedirect(),
								]);
							}}
						>
							<Plus />
							Add Redirect
						</Button>
					)}
					<Button type="submit" form={id}>
						{step === Step.Submit ? "Submit" : "Next"}
					</Button>
				</Field>
			</form>
		</div>
	);
}
