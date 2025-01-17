import Link from "next/link";
import { useRouter } from "next/router";

interface Props {
	to: string;
	name: string;
	external?: boolean;
}

export default function NavButton({ to, name, external }: Props) {
	const router = useRouter();
	const active = router.pathname.includes(to);
	
	const href = {
		pathname: to,
		query: router.query
	};

	const activeClass = active ? "bg-menu-active-bg menu-active-text" : "bg-menu-default-bg menu-default-text";
	const hoverClass = "hover:bg-menu-hover-bg hover:menu-hover-text";

	return (
		<Link
			className={`h-9 px-3 py-2.5 rounded-lg justify-center items-center gap-1.5 inline-flex overflow-hidden ${activeClass} ${hoverClass}`}
			href={external ? to : href}
			target={external ? "_blank" : "_self"}
		>
			<span className="text-base font-medium leading-normal whitespace-nowrap">{name}</span>
		</Link>
	);
}
