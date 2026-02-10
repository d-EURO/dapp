import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useChainId } from "wagmi";

const POSITION_PAGE_PATTERNS = ["/mint/[address]", "/monitoring/[address]"];

export function useRedirectOnChainChange() {
	const router = useRouter();
	const chainId = useChainId();
	const prevChainIdRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		const isPositionPage = POSITION_PAGE_PATTERNS.some((pattern) => router.pathname.startsWith(pattern));
		if (!isPositionPage) return;

		const prevChainId = prevChainIdRef.current;
		const currentChainId = chainId;

		if (prevChainId !== undefined && currentChainId !== undefined && prevChainId !== currentChainId) {
			router.replace("/dashboard");
		}

		if (currentChainId !== undefined) {
			prevChainIdRef.current = currentChainId;
		}
	}, [chainId, router]);
}
