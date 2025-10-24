import { useForm } from "@tanstack/react-form";
import { useId } from "react";
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

const domainFormSchema = z.object({
	domain: z.hostname().min(1),
});

export const Domain = () => {
	const id = useId();
	const form = useForm({
		defaultValues: {
			domain: "",
		},
		validators: {
			onSubmit: domainFormSchema,
		},
		onSubmit: async ({ value }) => {
			console.log(value.domain);
		},
	});

	return (
		<form
			id={id}
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="mt-44"
		>
			<FieldGroup>
				<form.Field
					name="domain"
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
									The domain of your webiste (example.com)
								</FieldDescription>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				/>
			</FieldGroup>
			<Field orientation="horizontal" className="mt-6">
				<Button type="submit" form={id}>
					Procedi
				</Button>
			</Field>
		</form>
	);
};
