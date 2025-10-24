"use client";

import { Activity, useState } from "react";
import { Domain } from "./_domain";

enum Step {
	Domain = 0,
	Validate = 1,
	Redirects = 2,
	Submit = 3,
}

export default function NewPage() {
	const [step, setStep] = useState<Step>(Step.Domain);

	return (
		<div className="mx-auto w-full max-w-xl">
			<Activity mode={step === Step.Domain ? "visible" : "hidden"}>
				<Domain />
			</Activity>
		</div>
	);
}
