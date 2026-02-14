import { Address } from "viem";
import { mainnet } from "@config";

// TODO: Remove this file once @juicedollar/jusd@3.0.2+ is published with correct genesis position

export const MAINNET_CHAIN_ID = mainnet.id;

// HARDCODED: Mainnet genesis position (NPM package has zeroAddress)
export const MAINNET_GENESIS_POSITION: Address = "0xeA4512AB7EDa6Ac7745FE8F97C80014d80fcF7E8";
