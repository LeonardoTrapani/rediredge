import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export default function UserMenu() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	const { data: customerState } = useQuery({
		queryKey: ["customerState"],
		queryFn: async () => {
			const { data } = await authClient.customer.state();
			return data;
		},
		enabled: !!session,
	});

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Button variant="outline">
				<Link href="/login">Sign In</Link>
			</Button>
		);
	}

	const hasActiveSubscription =
		customerState?.activeSubscriptions &&
		customerState.activeSubscriptions.length > 0;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-8 w-8 rounded-full">
					<Avatar className="h-8 w-8">
						<AvatarFallback>
							{session.user.name
								?.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuLabel>My Account</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>{session.user.email}</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					{hasActiveSubscription ? (
						<Button
							variant="ghost"
							className="w-full"
							onClick={async () => await authClient.customer.portal()}
						>
							Manage Payments
						</Button>
					) : (
						<Button
							variant="ghost"
							className="w-full"
							onClick={async () => await authClient.checkout({ slug: "pro" })}
						>
							Setup Payments
						</Button>
					)}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Button
						variant="outline"
						className="w-full"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										router.push("/");
									},
								},
							});
						}}
					>
						Sign Out
					</Button>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
