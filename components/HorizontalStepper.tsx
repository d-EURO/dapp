"use client";

import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState } from "react";
import LoadingSpin from "./LoadingSpin";

interface Step {
	id: number;
	name: string;
}

interface HorizontalStepperProps {
	steps: Step[];
	currentStep: number;
	isStepLoading?: boolean;
}

export function HorizontalStepper({ steps, currentStep, isStepLoading }: HorizontalStepperProps) {
	return (
		<div className="w-full max-w-3xl mx-auto pb-12 px-4 flex flex-col items-center">
			<div aria-label="Progress">
				<ol className="flex items-center">
					{steps.map((step, stepIdx) => (
						<li key={step.name} className={`${stepIdx !== 0 ? "pl-8 sm:pl-20" : ""} relative`} id={`step-span-${step.id}`}>
							<div
								className={`relative w-6 h-6 flex z-10 items-center justify-center rounded-full ${
									step.id < currentStep
										? "bg-text-subheader"
										: step.id === currentStep
										? "border-2 bg-white border-text-subheader"
										: "bg-white border-2 border-gray-300 hover:border-gray-400"
								}`}
							>
								{step.id < currentStep ? (
									<FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-white" />
								) : step.id === currentStep ? (
									isStepLoading ? <LoadingSpin /> :  <div className="w-2 h-2 bg-gray-200 rounded-full" />
								) : (
									<div className="w-2 h-2 bg-gray-200 rounded-full" />
								)}
								<div className="absolute text-center leading-4">
									<div className="h-8" />
									<div className="relative">
										<div className="absolute -translate-x-1/2">
											<span
												className={`inline-block text-center ${
													step.id === currentStep ? "text-[0.75rem]/[1.3]" : "text-[0.67rem]/[1.3] text-gray-500"
												}`}
											>
												{step.name}
											</span>
										</div>
									</div>
								</div>
							</div>
							{stepIdx !== 0 && (
								<div className="absolute inset-0 flex items-center" aria-hidden="true">
									<div className="h-1 w-full bg-gray-200">
										<div
											className={
												`h-1 ${step.id <= currentStep ? "bg-gray-500" : "bg-gray-300"}` /* color of the line */
											}
										/>
									</div>
								</div>
							)}
						</li>
					))}
				</ol>
			</div>
		</div>
	);
}
