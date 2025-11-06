"use client";

import { useForm } from "@tanstack/react-form";
import { Github, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function UnifiedAuthForm() {
	const [emailSent, setEmailSent] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.magicLink(
				{
					email: value.email,
					callbackURL: "/p/dashboard",
				},
				{
					onSuccess: () => {
						setEmailSent(true);
						toast.success("Magic link sent! Check your email.");
					},
					onError: (error) => {
						toast.error(error.error.message || "Failed to send magic link");
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
			}),
		},
	});

	const handleSocialSignIn = async (provider: "github" | "google") => {
		try {
			await authClient.signIn.social({
				provider,
				callbackURL: "/p/dashboard",
			});
		} catch {
			toast.error(`Failed to sign in with ${provider}`);
		}
	};

	if (emailSent) {
		return (
			<div className="mx-auto mt-10 w-full max-w-md p-6">
				<div className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
						<Mail className="h-6 w-6 text-green-600" />
					</div>
					<h1 className="mb-2 font-bold text-2xl">Check your email</h1>
					<p className="mb-6 text-muted-foreground">
						We've sent a magic link to your email address. Click the link to
						sign in.
					</p>
					<Button
						variant="outline"
						onClick={() => setEmailSent(false)}
						className="w-full"
					>
						Send another link
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">Welcome</h1>

			<div className="space-y-4">
				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={() => handleSocialSignIn("github")}
				>
					<Github className="mr-2 h-4 w-4" />
					Continue with GitHub
				</Button>

				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={() => handleSocialSignIn("google")}
				>
					{/** biome-ignore lint/a11y/noSvgWithoutTitle: google svg */}
					<svg
						className="mr-2 h-4 w-4"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
					Continue with Google
				</Button>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">
							Or continue with email
						</span>
					</div>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="email">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Email</Label>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									placeholder="name@example.com"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.map((error) => (
									<p key={error?.message} className="text-red-500 text-sm">
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>

					<form.Subscribe>
						{(state) => (
							<Button
								type="submit"
								className="w-full"
								disabled={!state.canSubmit || state.isSubmitting}
							>
								{state.isSubmitting ? "Sending..." : "Send magic link"}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</div>

			<p className="mt-6 text-center text-muted-foreground text-xs">
				By continuing, you agree to our Terms of Service and Privacy Policy.
			</p>
		</div>
	);
}
