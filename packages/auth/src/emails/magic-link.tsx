import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

interface MagicLinkEmailProps {
	magicLink: string;
}

export function MagicLinkEmail({ magicLink }: MagicLinkEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>Sign in to your account</Preview>
			<Body style={main}>
				<Container style={container}>
					<Heading style={h1}>Sign in to your account</Heading>
					<Text style={text}>
						Click the button below to sign in to your account. This link will
						expire in 5 minutes.
					</Text>
					<Section style={buttonContainer}>
						<Button style={button} href={magicLink}>
							Sign In
						</Button>
					</Section>
					<Text style={footer}>
						If you didn't request this email, you can safely ignore it.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
	backgroundColor: "#ffffff",
	margin: "0 auto",
	padding: "20px 0 48px",
	marginBottom: "64px",
};

const h1 = {
	color: "#333",
	fontSize: "24px",
	fontWeight: "bold",
	margin: "40px 0",
	padding: "0",
	textAlign: "center" as const,
};

const text = {
	color: "#333",
	fontSize: "16px",
	lineHeight: "26px",
	textAlign: "center" as const,
	padding: "0 40px",
};

const buttonContainer = {
	padding: "27px 0 27px",
	textAlign: "center" as const,
};

const button = {
	backgroundColor: "#000000",
	borderRadius: "6px",
	color: "#fff",
	fontSize: "16px",
	fontWeight: "bold",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "block",
	padding: "12px 24px",
};

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	marginTop: "32px",
	padding: "0 40px",
};
