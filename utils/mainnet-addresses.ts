import { Address } from "viem";
import { mainnet } from "@config";

// TODO: Remove this file once @juicedollar/jusd@3.0.2+ is published with correct genesis position

export const MAINNET_CHAIN_ID = mainnet.id;

// HARDCODED: Mainnet genesis position (NPM package has zeroAddress)
export const MAINNET_GENESIS_POSITION: Address = "0xe8c97614Ac1A5Ac0e8aB2d0e04b4B315817ecb36";
