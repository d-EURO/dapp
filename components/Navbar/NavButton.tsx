import Link from "next/link";
import { useRouter } from "next/router";
import { getCarryOnQueryParams, toQueryString } from "../../utils/url";

interface Props {
	to: string;
	name: string;
	external?: boolean;
}

export default function NavButton({ to, name, external }: Props) {
	const router = useRouter();
	const active = router.pathname.includes(to);
	const carryOnQueryParams = getCarryOnQueryParams(router);

	const href = `${to}${toQueryString(carryOnQueryParams)}`;

	const baseClass = "inline-flex h-9 px-3 py-2.5 items-center gap-1.5 shrink-0 rounded-lg overflow-hidden";
	const stateClass = active ? "bg-menu-active-bg text-menu-active-text" : "bg-menu-default-bg text-menu-default-text";
	const hoverClass = "hover:bg-menu-hover-bg hover:menu-hover-text";

	return (
		<Link
			className={`${baseClass} ${stateClass} ${hoverClass} justify-start sm:justify-center`}
			href={external ? to : href}
			target={external ? "_blank" : "_self"}
		>
			<span className="text-base font-normal leading-normal whitespace-nowrap">{name}</span>
		</Link>
	);
}
