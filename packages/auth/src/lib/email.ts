import { render } from "@react-email/components";
import { Resend } from "resend";
import { MagicLinkEmail } from "../emails/magic-link";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLinkEmail(email: string, url: string) {
	const emailHtml = await render(MagicLinkEmail({ magicLink: url }));

	await resend.emails.send({
		from: process.env.EMAIL_FROM || "rediredge@notifications.leotrapani.com",
		to: email,
		subject: "Sign in to your account",
		html: emailHtml,
	});
}
