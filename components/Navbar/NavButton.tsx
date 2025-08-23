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

	const activeClass = active 
		? "bg-menu-active-bg text-menu-active-text dark:bg-slate-700 dark:text-slate-100" 
		: "bg-menu-default-bg text-menu-default-text dark:bg-transparent dark:text-slate-300";
	const hoverClass = "hover:bg-menu-hover-bg hover:text-menu-hover-text dark:hover:bg-slate-800 dark:hover:text-slate-100";

	return (
		<Link
			className={`w-[80%] sm:w-fit h-9 px-4 sm:px-3 py-2.5 rounded-lg justify-start sm:justify-center items-center gap-1.5 inline-flex overflow-hidden ${activeClass} ${hoverClass}`}
			href={external ? to : href}
			target={external ? "_blank" : "_self"}
		>
			<span className="text-base font-medium leading-normal whitespace-nowrap">{name}</span>
		</Link>
	);
}
