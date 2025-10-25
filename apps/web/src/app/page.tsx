import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
	return (
		<div className="flex flex-col items-center justify-center px-4 text-center">
			<div className="mx-auto max-w-3xl space-y-6">
				<Badge variant="secondary" className="mx-auto w-fit">
					In Development
				</Badge>
				<h1 className="font-bold text-4xl tracking-tight sm:text-6xl">
					Welcome to{" "}
					<span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
						Rediredge
					</span>
				</h1>
				<p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
					The fastest way to manage your redirects at the edge. Built for
					performance, scalability, and ease of use.
				</p>
				<div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
					<Button size="lg">
						<Link href="/login">Get Started</Link>
					</Button>
					<Button variant="outline" size="lg">
						<Link href="https://docs.rediredge.io">Learn More</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
