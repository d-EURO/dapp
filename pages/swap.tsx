import Head from "next/head";
import { useState } from "react";
import { useSwapStats } from "@hooks";
import { TOKEN_SYMBOL } from "@utils";
import SingleStepSwap from "@components/PageSwap/SingleStepSwap";
import MultiStepSwap from "@components/PageSwap/MultiStepSwap";

const STABLECOIN_SYMBOLS = ["EURT", "EURC", "VEUR", "EURS"];
const SYMBOLS = [TOKEN_SYMBOL, ...STABLECOIN_SYMBOLS];

export default function Swap() {
	const [fromSymbol, setFromSymbol] = useState(TOKEN_SYMBOL);
	const [toSymbol, setToSymbol] = useState(STABLECOIN_SYMBOLS[0]);
	const [fromOptions, setFromOptions] = useState(SYMBOLS.filter((s) => s !== STABLECOIN_SYMBOLS[0]));
	const [toOptions, setToOptions] = useState(STABLECOIN_SYMBOLS);
	const [isMultiStep, setIsMultiStep] = useState(false);
	const swapStats = useSwapStats();

	const handleFromSymbolChange = (symbol: string) => {
		setFromSymbol(symbol);
		setToOptions(SYMBOLS.filter((s) => s !== symbol));
		const isMultiStepCombination = STABLECOIN_SYMBOLS.includes(symbol) && STABLECOIN_SYMBOLS.includes(toSymbol);
		setIsMultiStep(isMultiStepCombination);
	};

	const handleToSymbolChange = (symbol: string) => {
		setToSymbol(symbol);
		setFromOptions(SYMBOLS.filter((s) => s !== symbol));
		const isMultiStepCombination = STABLECOIN_SYMBOLS.includes(symbol) && STABLECOIN_SYMBOLS.includes(fromSymbol);
		setIsMultiStep(isMultiStepCombination);
	};

	const onChangeDirection = () => {
		const prevFromSymbol = fromSymbol;
		const prevToSymbol = toSymbol;
		const prevFromOptions = fromOptions;	
		const prevToOptions = toOptions;
		
		setFromSymbol(prevToSymbol);
		setToSymbol(prevFromSymbol);
		setFromOptions(prevToOptions);
		setToOptions(prevFromOptions);
	};

	return (
		<>
			<Head>
				<title>dEURO - Swap</title>
			</Head>
			<div className="md:mt-8">
				{isMultiStep ? (
					<MultiStepSwap
						fromSymbol={fromSymbol}
						fromOptions={fromOptions}
						toSymbol={toSymbol}
						toOptions={toOptions}
						swapStats={swapStats}
						setFromSymbol={handleFromSymbolChange}
						setToSymbol={handleToSymbolChange}
						onChangeDirection={onChangeDirection}
					/>
				) : (
					<SingleStepSwap
						fromSymbol={fromSymbol}
						fromOptions={fromOptions}
						toSymbol={toSymbol}
						toOptions={toOptions}
						swapStats={swapStats}
						setFromSymbol={handleFromSymbolChange}
						setToSymbol={handleToSymbolChange}
						onChangeDirection={onChangeDirection}
					/>
				)}
			</div>
		</>
	);
}
