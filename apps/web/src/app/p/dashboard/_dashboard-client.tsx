"use client";

import { useMutation } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	MoreVerticalIcon,
	PlusIcon,
	PowerIcon,
	PowerOffIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/utils/trpc";

type DomainData = {
	id: string;
	apex: string;
	verified: boolean;
	verifiedAt: Date | null;
	totalRedirects: number;
	activeRedirects: number;
};

export default function DashboardClient({
	domains,
}: {
	domains: DomainData[];
}) {
	const router = useRouter();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

	const deleteMutation = useMutation({
		...trpc.domain.delete.mutationOptions(),
		onSuccess: () => {
			setDeleteDialogOpen(false);
			setDomainToDelete(null);
			router.refresh();
		},
	});

	const enableAllMutation = useMutation({
		...trpc.domain.enableAllRedirects.mutationOptions(),
		onSuccess: () => {
			router.refresh();
		},
	});

	const disableAllMutation = useMutation({
		...trpc.domain.disableAllRedirects.mutationOptions(),
		onSuccess: () => {
			router.refresh();
		},
	});

	const handleDeleteClick = (domainId: string) => {
		setDomainToDelete(domainId);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = () => {
		if (domainToDelete) {
			deleteMutation.mutate({ domainId: domainToDelete });
		}
	};

	return (
		<>
			<div className="container mx-auto max-w-3xl px-4 py-8">
				<div className="mb-8 flex items-center justify-between">
					<div>
						<h1 className="font-bold text-3xl">Your Domains</h1>
						<p className="mt-1 text-muted-foreground">
							Manage your domains and redirects
						</p>
					</div>
					<Link href="/p/new" className={buttonVariants()}>
						<PlusIcon />
						Add Domain
					</Link>
				</div>

				<div className="grid gap-6 md:grid-cols-2">
					{domains.map((domain) => {
						const inactiveRedirects =
							domain.totalRedirects - domain.activeRedirects;

						return (
							<Card key={domain.id}>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<span className="truncate">{domain.apex}</span>
										{!domain.verified && (
											<Badge variant="destructive" className="shrink-0">
												<AlertTriangleIcon />
												Unverified
											</Badge>
										)}
									</CardTitle>
									<CardAction>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon-sm">
													<MoreVerticalIcon />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem asChild>
													<Link href={`/p/${domain.apex}`}>
														<ArrowRightIcon />
														Manage Domain
													</Link>
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() =>
														enableAllMutation.mutate({ domainId: domain.id })
													}
													disabled={enableAllMutation.isPending}
												>
													<PowerIcon />
													Enable All Redirects
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														disableAllMutation.mutate({ domainId: domain.id })
													}
													disabled={disableAllMutation.isPending}
												>
													<PowerOffIcon />
													Disable All Redirects
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													variant="destructive"
													onClick={() => handleDeleteClick(domain.id)}
												>
													<TrashIcon />
													Delete Domain
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</CardAction>
								</CardHeader>

								<CardContent className="space-y-4">
									<div className="grid grid-cols-3 gap-4 text-center">
										<div>
											<div className="font-semibold text-2xl">
												{domain.totalRedirects}
											</div>
											<div className="text-muted-foreground text-xs">Total</div>
										</div>
										<div>
											<div className="font-semibold text-2xl text-green-600 dark:text-green-500">
												{domain.activeRedirects}
											</div>
											<div className="text-muted-foreground text-xs">
												Active
											</div>
										</div>
										<div>
											<div className="font-semibold text-2xl text-muted-foreground">
												{inactiveRedirects}
											</div>
											<div className="text-muted-foreground text-xs">
												Inactive
											</div>
										</div>
									</div>

									<Link
										href={`/p/${domain.apex}`}
										className={buttonVariants({
											variant: "outline",
											className: "w-full",
										})}
									>
										Manage Domain
										<ArrowRightIcon />
									</Link>
								</CardContent>
							</Card>
						);
					})}
				</div>
			</div>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Domain</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this domain? This will permanently
							delete the domain and all of its redirects. This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteConfirm}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete Domain"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
