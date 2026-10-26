"use client";

import { useState, type FormEvent } from "react";
import { InvalidSdkInputError } from "@slasettle/sdk";
import { FormField, inputClassName } from "@/components/form-field";
import { EndpointCommitmentValue } from "@/components/endpoint-commitment-value";
import { verifyEndpointCommitment } from "@/lib/endpoint-commitment";

type VerificationResult =
  | { status: "match"; computedHash: Uint8Array }
  | { status: "mismatch"; computedHash: Uint8Array }
  | null;

export function EndpointVerifier({ endpointHash }: { endpointHash: Uint8Array }) {
  const [endpoint, setEndpoint] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<VerificationResult>(null);

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setResult(null);
    try {
      const verification = verifyEndpointCommitment(endpoint, endpointHash);
      setResult({
        status: verification.matches ? "match" : "mismatch",
        computedHash: verification.computedHash,
      });
    } catch (verificationError) {
      setError(
        verificationError instanceof InvalidSdkInputError
          ? "Enter a valid absolute HTTP or HTTPS URL."
          : "The endpoint could not be verified.",
      );
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-raised)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-fg-primary)]">Endpoint commitment</h3>
      <div className="mt-2">
        <EndpointCommitmentValue endpointHash={endpointHash} />
      </div>
      <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
        The raw endpoint is not stored in the contract. SLASettle commits to this hash. The commitment binds
        watcher votes to the agreed endpoint; it does not prove that an HTTP request was honestly performed.
      </p>

      <form onSubmit={verify} noValidate className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
        <FormField
          label="Verify an endpoint"
          help="This comparison runs only in your browser and is not sent or saved."
          error={error}
        >
          {(props) => (
            <input
              {...props}
              className={inputClassName}
              type="url"
              placeholder="https://example.com/health"
              value={endpoint}
              onChange={(event) => {
                setEndpoint(event.target.value);
                setError(undefined);
                setResult(null);
              }}
            />
          )}
        </FormField>
        <button
          type="submit"
          className="mt-3 rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-fg-primary)] hover:border-[var(--color-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Compare commitment
        </button>
      </form>

      {result && (
        <div className="mt-3 rounded-md border border-[var(--color-border-default)] p-3" role="status" aria-live="polite">
          <p className="text-sm font-semibold text-[var(--color-fg-primary)]">
            {result.status === "match" ? "MATCH" : "DOES NOT MATCH"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            {result.status === "match"
              ? "A match confirms that this endpoint string produces the SLA's stored commitment."
              : "This endpoint string produces a different commitment."}
          </p>
          <div className="mt-2">
            <EndpointCommitmentValue endpointHash={result.computedHash} />
          </div>
        </div>
      )}
    </div>
  );
}
