import { useState } from "react";
import TokenLogo from "@components/TokenLogo";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import Button from "@components/Button";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { Details } from "./Details";
import { useTranslation } from "next-i18next";

export const CollateralManageSection = () => {
	const { t } = useTranslation();
	const [isAdd, setIsAdd] = useState(true);

	return (
		<div className="flex flex-col gap-y-8">
			<div className="flex flex-col gap-y-3">
				<div className="flex flex-row justify-between items-center">
					<div className="pl-3 flex flex-row gap-x-2 items-center">
						<TokenLogo currency="WETH" />
						<div className="flex flex-col">
							<span className="text-base font-extrabold leading-tight">
								<span className="">4.811</span> WETH
							</span>
							<span className="text-xs font-medium text-text-muted2 leading-[1rem]">12,345.6789 dEURO</span>
						</div>
					</div>
					<div className="flex flex-row justify-end items-center">
						<button className="px-2 flex flex-row gap-x-1 items-center py-1" onClick={() => setIsAdd(!isAdd)}>
							<AddCircleOutlineIcon color={isAdd ? "#065DC1" : "#8B92A8"} />
							<span className={`mt-0.5 ${isAdd ? "text-button-textGroup-primary-text" : "text-button-textGroup-secondary-text"} text-base font-extrabold leading-tight`}>{t("common.add")}</span>
						</button>
						<button className="px-2 flex flex-row gap-x-1 items-center py-1" onClick={() => setIsAdd(!isAdd)}>
							<RemoveCircleOutlineIcon color={isAdd ? "#8B92A8" : "#065DC1"} />
							<span className={`mt-0.5 ${isAdd ? "text-button-textGroup-secondary-text" : "text-button-textGroup-primary-text"} text-base font-extrabold leading-tight`}>{t("common.remove")}</span>
						</button>
					</div>
				</div>
				<div className="w-full">
					<NormalInputOutlined
						showTokenLogo={false}
						value={"0"}
						onChange={() => {}}
						decimals={2}
						unit="WETH"
						adornamentRow={
							<div className="pl-2 text-xs leading-[1rem] flex flex-row gap-x-2">
								<span className="font-medium text-text-muted3">{t(isAdd ? "mint.available_to_add" : "mint.available_to_remove")}:</span>
								<button className="text-text-labelButton font-extrabold">9.231 WETH</button>
							</div>
						}
					/>
				</div>
				<div className="w-full mt-1.5 px-4 py-2 rounded-xl bg-[#E4F0FC] flex flex-row justify-between items-center text-base font-extrabold text-[#272B38]">
					<span>{t("mint.collateralization")}</span>
					<span>100%</span>
				</div>
			</div>
			<Button className="text-lg leading-snug !font-extrabold">{t(isAdd ? "mint.add_collateral" : "mint.remove_collateral")}</Button>
			<Details />
		</div>
	);
};
