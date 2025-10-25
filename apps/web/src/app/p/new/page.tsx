"use client";

import { redirectCode } from "@rediredge/db/schema/domains";
import { useForm } from "@tanstack/react-form";
import { CornerDownRight, MoveRight, Plus, Trash2 } from "lucide-react";
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

const subdomainSchema = z.string().min(1);
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
			console.log("submitted", value);
			if (step < Step.Submit) {
				return setStep((prev) => prev + 1);
			}

			console.log("submitted", value);
		},
	});

	return (
		<div
			className={`mx-auto w-full px-4 transition-all ${step === Step.Domain ? "max-w-md" : "max-w-3xl"}`}
		>
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
										<div
											key={redirect.id}
											className="group relative flex items-center gap-4 transition-all"
										>
											<CornerDownRight className="-translate-y-[3px]" />
											<form.Field
												name={`redirects[${index}].subdomain`}
												validators={{
													onSubmit: subdomainSchema,
												}}
											>
												{(subField) => {
													const isInvalid =
														subField.state.meta.isTouched &&
														!subField.state.meta.isValid;

													return (
														<Field className="flex-1">
															<ButtonGroup>
																<ButtonGroupText asChild>
																	<Label htmlFor={`subdomain-${redirect.id}`}>
																		https://
																	</Label>
																</ButtonGroupText>
																<Input
																	id={`subdomain-${redirect.id}`}
																	value={subField.state.value ?? ""}
																	onChange={(e) =>
																		subField.handleChange(e.target.value)
																	}
																	onBlur={subField.handleBlur}
																	placeholder="cal"
																/>
																<form.Subscribe
																	selector={(state) => state.values.domain}
																	children={(domain) => (
																		<ButtonGroupText asChild>
																			<Label
																				htmlFor={`subdomain-${redirect.id}`}
																			>
																				.{domain}
																			</Label>
																		</ButtonGroupText>
																	)}
																/>
															</ButtonGroup>
															{isInvalid && (
																<FieldError
																	errors={subField.state.meta.errors}
																/>
															)}
														</Field>
													);
												}}
											</form.Field>
											<MoveRight />
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
															<Input
																value={destField.state.value ?? ""}
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
											{field.state.value.length > 1 && (
												<Button
													type="button"
													size="icon"
													variant="outline"
													className="-right-14 absolute opacity-0 transition-opacity group-hover:opacity-100"
													onClick={() => {
														const currentRedirects =
															form.getFieldValue("redirects") || [];
														form.setFieldValue(
															"redirects",
															currentRedirects.filter((_, i) => i !== index),
														);
													}}
												>
													<Trash2 className="size-4" />
												</Button>
											)}
										</div>
									))}
								</div>
							)}
						</form.Field>
					</Activity>
				</FieldGroup>
				<Field orientation="horizontal" className="mt-8">
					{step >= Step.Redirects && (
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
