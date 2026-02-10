import { randomBytes } from "node:crypto";
import { makeSignDoc, serializeSignDoc } from "@cosmjs/amino";
import {
  Secp256k1,
  Secp256k1Signature,
  ripemd160,
  sha256,
} from "@cosmjs/crypto";
import {
  fromBase64,
  normalizeBech32,
  toBase64,
  toBech32,
  toUtf8,
} from "@cosmjs/encoding";
import { HttpError } from "../../shared/http-error.js";
import { nowIso } from "../../shared/ids.js";
import type {
  PublicWalletLink,
  WalletChainType,
} from "../../shared/models.js";
import { toPublicWalletLink } from "../../shared/models.js";
import type { WalletRepository } from "./wallet.repository.js";

const CHALLENGE_TTL_SECONDS = 5 * 60;

type SupportedChain = WalletChainType;

interface CreateChallengeInput {
  userId: string;
  walletAddress: string;
  chainType: string | undefined;
}

interface VerifyChallengeInput {
  userId: string;
  challengeId: string;
  signature: string;
  publicKeyBase64: string;
}

function parseChainType(chainType: string | undefined): SupportedChain {
  if (!chainType) {
    return "COSMOS";
  }

  const normalized = chainType.trim().toUpperCase();
  if (normalized === "COSMOS") {
    return "COSMOS";
  }

  throw new HttpError(400, "Unsupported chainType. Expected COSMOS");
}

function normalizeCosmosAddress(walletAddress: string): string {
  const trimmed = walletAddress.trim();
  if (!trimmed) {
    throw new HttpError(400, "walletAddress is required");
  }

  try {
    return normalizeBech32(trimmed);
  } catch {
    throw new HttpError(400, "walletAddress must be valid bech32");
  }
}

function extractBech32Prefix(walletAddress: string): string {
  const separatorIndex = walletAddress.indexOf("1");
  if (separatorIndex <= 0) {
    throw new HttpError(400, "walletAddress has invalid bech32 prefix");
  }

  const prefix = walletAddress.slice(0, separatorIndex);
  if (!/^[a-z0-9]{1,20}$/.test(prefix)) {
    throw new HttpError(400, "walletAddress prefix is invalid");
  }

  return prefix;
}

function isExpired(isoTimestamp: string): boolean {
  const expiresAt = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return expiresAt <= Date.now();
}

function buildWalletChallengeMessage(params: {
  serviceName: string;
  userId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    "Wheat & Stone Wallet Link",
    "",
    `Service: ${params.serviceName}`,
    `User ID: ${params.userId}`,
    `Wallet Address: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expires At: ${params.expiresAt}`,
    "",
    "Sign this message to link your wallet to your account.",
    "Only sign this request if you initiated it.",
  ].join("\n");
}

function buildAdr36SignBytes(walletAddress: string, message: string): Uint8Array {
  const signDoc = makeSignDoc(
    [
      {
        type: "sign/MsgSignData",
        value: {
          signer: walletAddress,
          data: toBase64(toUtf8(message)),
        },
      },
    ],
    {
      gas: "0",
      amount: [],
    },
    "",
    undefined,
    "0",
    "0",
  );

  return serializeSignDoc(signDoc);
}

function normalizePublicKey(publicKeyBase64: string): Uint8Array {
  const trimmed = publicKeyBase64.trim();
  if (!trimmed) {
    throw new HttpError(400, "publicKey is required");
  }

  try {
    const decoded = fromBase64(trimmed);
    if (decoded.length !== 33 && decoded.length !== 65) {
      throw new HttpError(400, "publicKey must be compressed or uncompressed secp256k1");
    }

    return decoded;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(400, "publicKey must be valid base64");
  }
}

function normalizeSignature(signatureBase64: string): Secp256k1Signature {
  const trimmed = signatureBase64.trim();
  if (!trimmed) {
    throw new HttpError(400, "signature is required");
  }

  try {
    const raw = fromBase64(trimmed);
    const fixedLength = raw.length === 65 ? raw.slice(0, 64) : raw;

    if (fixedLength.length !== 64) {
      throw new HttpError(400, "signature must be 64-byte base64");
    }

    return Secp256k1Signature.fromFixedLength(fixedLength);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(400, "signature must be valid base64");
  }
}

function deriveCosmosAddressFromPubkey(pubkey: Uint8Array, prefix: string): string {
  const compressed = Secp256k1.compressPubkey(pubkey);
  const rawAddress = ripemd160(sha256(compressed));
  return normalizeBech32(toBech32(prefix, rawAddress));
}

function verifyCosmosAdr36Signature(input: {
  walletAddress: string;
  message: string;
  signatureBase64: string;
  publicKeyBase64: string;
}): void {
  const normalizedWalletAddress = normalizeCosmosAddress(input.walletAddress);
  const prefix = extractBech32Prefix(normalizedWalletAddress);

  const publicKey = normalizePublicKey(input.publicKeyBase64);
  const normalizedSignature = normalizeSignature(input.signatureBase64);

  const compressedPubkey = Secp256k1.compressPubkey(publicKey);
  const signBytes = buildAdr36SignBytes(normalizedWalletAddress, input.message);
  const digest = sha256(signBytes);

  const signatureValid = Secp256k1.verifySignature(
    normalizedSignature,
    digest,
    compressedPubkey,
  );

  if (!signatureValid) {
    throw new HttpError(401, "Invalid wallet signature");
  }

  const derivedAddress = deriveCosmosAddressFromPubkey(compressedPubkey, prefix);
  if (derivedAddress !== normalizedWalletAddress) {
    throw new HttpError(401, "Signature public key does not match wallet address");
  }
}

export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly serviceName: string,
  ) {}

  getLinkedWallet(userId: string): PublicWalletLink | null {
    const wallet = this.walletRepository.findWalletByUserId(userId);
    return wallet ? toPublicWalletLink(wallet) : null;
  }

  createChallenge(input: CreateChallengeInput): {
    challengeId: string;
    chainType: SupportedChain;
    walletAddress: string;
    message: string;
    expiresAt: string;
  } {
    const chainType = parseChainType(input.chainType);
    const walletAddress = normalizeCosmosAddress(input.walletAddress);
    const walletAddressPrefix = extractBech32Prefix(walletAddress);

    this.walletRepository.cleanupExpiredChallenges(nowIso());

    const now = new Date();
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
    const nonce = randomBytes(24).toString("base64url");

    const message = buildWalletChallengeMessage({
      serviceName: this.serviceName,
      userId: input.userId,
      walletAddress,
      nonce,
      issuedAt,
      expiresAt,
    });

    const challenge = this.walletRepository.createChallenge({
      userId: input.userId,
      chainType,
      walletAddress,
      nonce,
      message,
      expiresAt,
    });

    // Defend against impossible/invalid address-prefix edge cases before response.
    if (!walletAddressPrefix) {
      throw new HttpError(400, "walletAddress prefix is invalid");
    }

    return {
      challengeId: challenge.id,
      chainType,
      walletAddress,
      message,
      expiresAt,
    };
  }

  verifyAndLink(input: VerifyChallengeInput): PublicWalletLink {
    const challengeId = input.challengeId.trim();
    if (!challengeId) {
      throw new HttpError(400, "challengeId is required");
    }

    const challenge = this.walletRepository.findChallengeById(challengeId);
    if (!challenge) {
      throw new HttpError(404, "Wallet challenge not found");
    }

    if (challenge.userId !== input.userId) {
      throw new HttpError(403, "Wallet challenge does not belong to this user");
    }

    if (challenge.usedAt) {
      throw new HttpError(409, "Wallet challenge already used");
    }

    if (isExpired(challenge.expiresAt)) {
      throw new HttpError(410, "Wallet challenge expired");
    }

    // Always consume the challenge once verify is attempted to prevent replay.
    this.walletRepository.markChallengeUsed(challenge.id);

    if (challenge.chainType !== "COSMOS") {
      throw new HttpError(400, "Unsupported chainType on challenge");
    }

    verifyCosmosAdr36Signature({
      walletAddress: challenge.walletAddress,
      message: challenge.message,
      signatureBase64: input.signature,
      publicKeyBase64: input.publicKeyBase64,
    });

    const existingByAddress = this.walletRepository.findWalletByAddress(challenge.walletAddress);
    if (existingByAddress && existingByAddress.userId !== input.userId) {
      throw new HttpError(409, "Wallet address is already linked to another user");
    }

    const walletAddressPrefix = extractBech32Prefix(challenge.walletAddress);
    const timestamp = nowIso();
    const linked = this.walletRepository.upsertWalletLink({
      userId: input.userId,
      chainType: challenge.chainType,
      walletAddress: challenge.walletAddress,
      walletAddressPrefix,
      publicKeyBase64: input.publicKeyBase64.trim(),
      linkedAt: timestamp,
      lastVerifiedAt: timestamp,
    });

    return toPublicWalletLink(linked);
  }

  unlinkWallet(userId: string): { unlinked: boolean } {
    const removed = this.walletRepository.removeWalletByUserId(userId);
    return { unlinked: Boolean(removed) };
  }
}
