import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import React from "react";

interface MagicLinkEmailProps {
	magicLink: string;
}

export function MagicLinkEmail({ magicLink }: MagicLinkEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>Sign in to your account</Preview>
			<Tailwind>
				<Body className="bg-gray-50 font-sans">
					<Container className="mx-auto mb-16 bg-white px-0 py-5">
						<Heading className="my-10 p-0 text-center font-bold text-2xl text-gray-800">
							Sign in to your account
						</Heading>
						<Text className="px-10 text-center text-base text-gray-800 leading-relaxed">
							Click the button below to sign in to your account. This link will
							expire in 5 minutes.
						</Text>
						<Section className="py-7 text-center">
							<Button
								href={magicLink}
								className="inline-block rounded-md bg-black px-6 py-3 text-center font-bold text-base text-white no-underline"
							>
								Sign In
							</Button>
						</Section>
						<Text className="mt-8 px-10 text-center text-gray-500 text-xs leading-4">
							If you didn't request this email, you can safely ignore it.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
