"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SuccessPage() {
	const router = useRouter();

	useEffect(() => {
		const redirectPath = sessionStorage.getItem("redirectAfterCheckout");
		if (redirectPath) {
			sessionStorage.removeItem("redirectAfterCheckout");
			router.replace(redirectPath as never);
		}
	}, [router]);

	return (
		<div className="px-4 py-8">
			<h1>Payment Successful!</h1>
			<p>Redirecting...</p>
		</div>
	);
}
