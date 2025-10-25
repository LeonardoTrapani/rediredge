"use client";

import { redirectCode } from "@rediredge/db/schema/domains";
import { useForm } from "@tanstack/react-form";
import {
	ArrowDown,
	CornerDownRight,
	MoveRight,
	Plus,
	Settings,
	Trash2,
} from "lucide-react";
import { Activity, Fragment, useId, useState } from "react";
import z from "zod";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

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

const createDefaultRedirect = (): {
	id: string;
	subdomain: string;
	code: (typeof redirectCode.enumValues)[number];
	desinationUrl: string;
	preservePath: boolean;
	preserveQuery: boolean;
} => ({
	id: crypto.randomUUID(),
	subdomain: "",
	code: "308",
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
								<div className="space-y-6 md:space-y-4">
									{field.state.value.map((redirect, index) => (
										<Fragment key={redirect.id}>
											{index > 0 && <Separator className="md:hidden" />}
											<div className="group relative flex flex-col gap-1 transition-all md:flex-row md:items-center md:gap-4">
												<CornerDownRight className="md:-translate-y-[3px] hidden md:block" />
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
															<Field className="md:flex-1">
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
																		aria-invalid={isInvalid}
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
												<ArrowDown className="mx-auto size-4 text-muted-foreground md:hidden" />
												<MoveRight className="hidden md:block" />
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
															<Field
																className="md:flex-1"
																data-invalid={isInvalid}
															>
																<InputGroup>
																	<InputGroupInput
																		value={destField.state.value ?? ""}
																		onChange={(e) =>
																			destField.handleChange(e.target.value)
																		}
																		onBlur={destField.handleBlur}
																		placeholder="https://cal.com/"
																		aria-invalid={isInvalid}
																	/>
																	<InputGroupAddon align="inline-end">
																		{field.state.value.length > 1 && (
																			<InputGroupButton
																				type="button"
																				variant="ghost"
																				size="icon-xs"
																				aria-label="Remove redirect"
																				onClick={() => {
																					const currentRedirects =
																						form.getFieldValue("redirects") ||
																						[];
																					form.setFieldValue(
																						"redirects",
																						currentRedirects.filter(
																							(_, i) => i !== index,
																						),
																					);
																				}}
																			>
																				<Trash2 />
																			</InputGroupButton>
																		)}
																		<DropdownMenu>
																			<DropdownMenuTrigger asChild>
																				<InputGroupButton
																					variant="ghost"
																					aria-label="Advanced settings"
																					size="icon-xs"
																				>
																					<Settings />
																				</InputGroupButton>
																			</DropdownMenuTrigger>
																			<DropdownMenuContent
																				align="end"
																				className="w-64 p-3"
																			>
																				<form.Field
																					name={`redirects[${index}].code`}
																				>
																					{(codeField) => (
																						<Field className="mb-3">
																							<FieldLabel
																								htmlFor={`redirect-code-${redirect.id}`}
																							>
																								Redirect Status
																							</FieldLabel>
																							<Select
																								name={codeField.name}
																								value={codeField.state.value}
																								onValueChange={(value) =>
																									codeField.handleChange(
																										value as (typeof redirectCode.enumValues)[number],
																									)
																								}
																							>
																								<SelectTrigger
																									id={`redirect-code-${redirect.id}`}
																									className="w-full"
																								>
																									<SelectValue />
																								</SelectTrigger>
																								<SelectContent>
																									<SelectItem value="301">
																										301 - Permanent
																									</SelectItem>
																									<SelectItem value="302">
																										302 - Temporary
																									</SelectItem>
																									<SelectItem value="307">
																										307 - Temporary (Preserve
																										Method)
																									</SelectItem>
																									<SelectItem value="308">
																										308 - Permanent (Preserve
																										Method)
																									</SelectItem>
																								</SelectContent>
																							</Select>
																						</Field>
																					)}
																				</form.Field>
																				<form.Field
																					name={`redirects[${index}].preservePath`}
																				>
																					{(preservePathField) => (
																						<Field
																							orientation="horizontal"
																							className="mb-3 flex items-center justify-between"
																						>
																							<FieldContent>
																								<FieldLabel
																									htmlFor={`preserve-path-${redirect.id}`}
																									className="cursor-pointer font-normal"
																								>
																									Preserve Path
																								</FieldLabel>
																								<FieldDescription className="text-xs">
																									Keep URL path in redirect
																								</FieldDescription>
																							</FieldContent>
																							<Switch
																								id={`preserve-path-${redirect.id}`}
																								checked={
																									preservePathField.state.value
																								}
																								onCheckedChange={
																									preservePathField.handleChange
																								}
																							/>
																						</Field>
																					)}
																				</form.Field>
																				<form.Field
																					name={`redirects[${index}].preserveQuery`}
																				>
																					{(preserveQueryField) => (
																						<Field
																							orientation="horizontal"
																							className="flex items-center justify-between"
																						>
																							<FieldContent>
																								<FieldLabel
																									htmlFor={`preserve-query-${redirect.id}`}
																									className="cursor-pointer font-normal"
																								>
																									Preserve Query
																								</FieldLabel>
																								<FieldDescription className="text-xs">
																									Keep query parameters
																								</FieldDescription>
																							</FieldContent>
																							<Switch
																								id={`preserve-query-${redirect.id}`}
																								checked={
																									preserveQueryField.state.value
																								}
																								onCheckedChange={
																									preserveQueryField.handleChange
																								}
																							/>
																						</Field>
																					)}
																				</form.Field>
																			</DropdownMenuContent>
																		</DropdownMenu>
																	</InputGroupAddon>
																</InputGroup>
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
										</Fragment>
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
