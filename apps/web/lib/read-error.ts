import { InvalidSdkConfigError, InvalidSdkInputError, MissingSdkConfigError, SorobanSimulationError } from "@slasettle/sdk";
import {
  IndexerApiError,
  IndexerResponseError,
  IndexerUnavailableError,
  MissingIndexerConfigError,
} from "./indexer";

/**
 * Turns a failure from a contract read or an indexer request into a message
 * that says which dependency failed, so the UI never has to fall back to a
 * generic "something went wrong".
 */
export function describeReadError(error: unknown): string {
  if (error instanceof MissingSdkConfigError || error instanceof InvalidSdkConfigError) {
    return `This deployment is not configured correctly. ${error.message}`;
  }
  if (error instanceof MissingIndexerConfigError) {
    return error.message;
  }
  if (error instanceof SorobanSimulationError) {
    return `The contract rejected the read: ${error.rpcMessage}`;
  }
  if (error instanceof InvalidSdkInputError) {
    return error.message;
  }
  if (
    error instanceof IndexerUnavailableError ||
    error instanceof IndexerApiError ||
    error instanceof IndexerResponseError
  ) {
    return error.message;
  }
  if (error instanceof TypeError || error instanceof RangeError) {
    // The SDK throws these when a contract returns data of an unexpected shape.
    return `The contract returned data this app does not recognize. ${error.message}`;
  }
  if (error instanceof Error) {
    return `Soroban RPC request failed: ${error.message}`;
  }
  return "The request failed for an unknown reason.";
}
