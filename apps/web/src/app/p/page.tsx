import { redirect } from "next/navigation";

export default function PrivatePage() {
	redirect("/p/dashboard");
}
