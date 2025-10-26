"use client";

import { bareDomainSchema } from "@rediredge/api/schemas/domain";
import type { redirectCode } from "@rediredge/db/schema/domains";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import {
	AlertCircle,
	ArrowDown,
	CornerDownRight,
	MoveRight,
	Plus,
	Settings,
	Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import react from "react";
import { toast } from "sonner";
import z from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
	type DomainWithRedirects,
	Step,
	useDomainStep,
} from "@/hooks/use-domain-step";
import { queryClient, trpc } from "@/utils/trpc";

const subdomainSchema = z.string().min(1);
const destinationUrlSchema = z.url("Must be a valid URL");

const createDefaultRedirect = (): Partial<
	DomainWithRedirects["redirects"][number]
> => ({
	id: crypto.randomUUID(),
	subdomain: "",
	code: "308",
	destinationUrl: "",
	preservePath: true,
	preserveQuery: true,
	enabled: false,
});

export function DomainForm({
	domainWithRedirects,
	isPending = false,
	error,
}: {
	domainWithRedirects?: DomainWithRedirects;
	isPending?: boolean;
	isSubscribed?: boolean;
	error?: TRPCClientErrorLike<any> | null;
}) {
	const router = useRouter();
	const { step } = useDomainStep(domainWithRedirects);
	const id = react.useId();
	const createDomainMutation = useMutation({
		...trpc.createDomain.mutationOptions(),
		onError: (error) => {
			toast.error(error.message);
		},
	});
	const verifyDomainMutation = useMutation({
		...trpc.verifyDomain.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: trpc.getDomainWithRedirects.queryKey(),
			});
			toast.success("Domain verified successfully!");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const form = useForm({
		defaultValues: {
			domain: domainWithRedirects ? domainWithRedirects.apex : "",
			redirects:
				domainWithRedirects?.redirects &&
				domainWithRedirects.redirects.length > 0
					? domainWithRedirects?.redirects
					: [createDefaultRedirect()],
		},
		onSubmit: async ({ value }) => {
			if (step === Step.Domain) {
				const { apex } = await createDomainMutation.mutateAsync({
					domain: value.domain,
				});
				return router.replace(`/p/${apex}`);
			}
			if (step === Step.Verification) {
				await verifyDomainMutation.mutateAsync({
					apex: value.domain,
				});
			}
			if (step === Step.Redirects) {
			}
		},
	});

	const isFormDisabled =
		isPending ||
		createDomainMutation.isPending ||
		verifyDomainMutation.isPending;

	if (error) {
		return (
			<div className="mx-auto mt-44 w-full max-w-md px-4">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error Loading Domain</AlertTitle>
					<AlertDescription className="mt-2">
						{error.message || "Failed to load domain. Please try again."}
					</AlertDescription>
				</Alert>
				<div className="mt-6 flex justify-center">
					<Button onClick={() => router.push("/p/new")}>
						Create New Domain
					</Button>
				</div>
			</div>
		);
	}

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
					<react.Activity mode={step >= Step.Domain ? "visible" : "hidden"}>
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
										{isPending ? (
											<Skeleton className="h-10 w-full" />
										) : (
											<Input
												id={id}
												name={field.name}
												value={field.state.value}
												disabled={step !== Step.Domain || isFormDisabled}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="example.com"
											/>
										)}
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
					</react.Activity>
					<react.Activity mode={step >= Step.Redirects ? "visible" : "hidden"}>
						<form.Field name="redirects" mode="array">
							{(field) => (
								<div className="space-y-6 md:space-y-4">
									{isPending ? (
										<div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4">
											<CornerDownRight className="md:-translate-y-[3px] hidden md:block" />
											<Skeleton className="h-10 w-full md:flex-1" />
											<MoveRight className="hidden md:block" />
											<Skeleton className="h-10 w-full md:flex-1" />
										</div>
									) : (
										field.state.value.map((redirect, index) => (
											<react.Fragment key={`${redirect.id}-${index}`}>
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
																			<Label
																				htmlFor={`subdomain-${redirect.id}`}
																			>
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
																			disabled={isFormDisabled}
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
														name={`redirects[${index}].destinationUrl`}
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
																			disabled={isFormDisabled}
																		/>
																		<InputGroupAddon align="inline-end">
																			{field.state.value.length > 1 && (
																				<InputGroupButton
																					type="button"
																					variant="ghost"
																					size="icon-xs"
																					aria-label="Remove redirect"
																					disabled={isFormDisabled}
																					onClick={() => {
																						field.removeValue(index);
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
																						disabled={isFormDisabled}
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
																									disabled={isFormDisabled}
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
																										preservePathField.state
																											.value
																									}
																									onCheckedChange={
																										preservePathField.handleChange
																									}
																									disabled={isFormDisabled}
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
																										preserveQueryField.state
																											.value
																									}
																									onCheckedChange={
																										preserveQueryField.handleChange
																									}
																									disabled={isFormDisabled}
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
											</react.Fragment>
										))
									)}
								</div>
							)}
						</form.Field>
					</react.Activity>
					<react.Activity
						mode={step === Step.Verification ? "visible" : "hidden"}
					>
						<form.Subscribe
							selector={(state) => state.values.domain}
							children={(domain) => (
								<Field>
									<FieldLabel>Step 1: Verify Domain Ownership</FieldLabel>
									<FieldDescription>
										Add this TXT record to your DNS provider to prove you own{" "}
										{domain}
									</FieldDescription>
									{isPending ? (
										<Skeleton className="mt-2 h-32 w-full" />
									) : (
										<div className="mt-2 rounded-md border bg-muted p-4 font-mono text-sm">
											<div className="grid gap-1">
												<div>
													<span className="text-muted-foreground">Host:</span>{" "}
													_rediredge
												</div>
												<div>
													<span className="text-muted-foreground">Type:</span>{" "}
													TXT
												</div>
												<div>
													<span className="text-muted-foreground">Value:</span>{" "}
													rediredge-verify={domainWithRedirects?.id}
												</div>
												<div>
													<span className="text-muted-foreground">TTL:</span>{" "}
													3600
												</div>
											</div>
										</div>
									)}
								</Field>
							)}
						/>
						<Field>
							<FieldLabel>Step 2: Route Traffic</FieldLabel>
							<FieldDescription>
								Add this wildcard CNAME to route all subdomain traffic to our
								redirector
							</FieldDescription>
							{isPending ? (
								<Skeleton className="mt-2 h-32 w-full" />
							) : (
								<div className="mt-2 rounded-md border bg-muted p-4 font-mono text-sm">
									<div className="grid gap-1">
										<div>
											<span className="text-muted-foreground">Host:</span> *
										</div>
										<div>
											<span className="text-muted-foreground">Type:</span> CNAME
										</div>
										<div>
											<span className="text-muted-foreground">Value:</span>{" "}
											redirector.rediredge.app
										</div>
										<div>
											<span className="text-muted-foreground">TTL:</span> 3600
										</div>
									</div>
								</div>
							)}
						</Field>
					</react.Activity>
				</FieldGroup>
				<Field orientation="horizontal" className="mt-8">
					{step >= Step.Redirects && (
						<Button
							variant="outline"
							type="button"
							disabled={isFormDisabled}
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
					<Button
						type="submit"
						form={id}
						disabled={isPending}
						loading={
							createDomainMutation.isPending || verifyDomainMutation.isPending
						}
					>
						{step === Step.Domain
							? "Submit"
							: step === Step.Verification
								? "Verify"
								: "Update"}
					</Button>
				</Field>
			</form>
		</div>
	);
}
