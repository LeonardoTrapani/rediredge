"use client";
import Image from "next/image";
import Link from "next/link";
import { ModeToggle } from "../mode-toggle";
import UserMenu from "../user-menu";
import { buttonVariants } from "./button";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "./navigation-menu";

export default function Navbar() {
	const links = [] as const;

	return (
		<div>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<div className="flex items-center gap-2">
					<Link
						href="/p/dashboard"
						className={buttonVariants({
							variant: "ghost",
							className: "!gap-1 font-semibold",
						})}
					>
						<Image
							src="/logo.svg"
							alt="Rediredge Logo"
							width={18}
							height={18}
						/>
						Rediredge
					</Link>
					<NavigationMenu>
						<NavigationMenuList>
							{links.map(({ to, label }) => (
								<NavigationMenuItem key={to}>
									<NavigationMenuLink
										asChild
										className={navigationMenuTriggerStyle()}
									>
										<Link href={to}>{label}</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>
							))}
						</NavigationMenuList>
					</NavigationMenu>
				</div>
				<div className="flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</div>
	);
}
