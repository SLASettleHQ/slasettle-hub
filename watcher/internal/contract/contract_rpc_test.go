package contract

// Tests that exercise Client.HasVoted and Client.SubmitCheck against a mock
// Stellar RPC server (see rpc_mock_test.go), covering the actual contract
// invocation this package builds, the submit -> sign -> submit -> poll
// pipeline, and its RPC/transaction failure paths.
//
// These are automated-test verified against a deterministic mock, not
// live-Testnet verified — see this package's coverage report for that
// distinction.

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stellar/go-stellar-sdk/keypair"
	protocol "github.com/stellar/go-stellar-sdk/protocols/rpc"
	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/xdr"
)

const testNetworkPassphrase = "Test SDF Network ; September 2015"

// newTestClient builds a Client wired to m, with a fresh random watcher
// keypair (never a real secret) and a syntactically valid but unregistered
// test contract ID (never a real deployed address).
func newTestClient(t *testing.T, m *mockRPC) (*Client, *keypair.Full, string) {
	t.Helper()
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random: %v", err)
	}
	var raw [32]byte
	raw[0] = 0x42
	contractID, err := strkey.Encode(strkey.VersionByteContract, raw[:])
	if err != nil {
		t.Fatalf("strkey.Encode: %v", err)
	}

	c, err := NewClient(m.URL(), testNetworkPassphrase, contractID, kp.Seed())
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return c, kp, contractID
}

func okResult(v any) rpcMethodHandler {
	return func(t *testing.T, _ json.RawMessage) (any, *jsonrpcError) {
		return v, nil
	}
}

func errResult(code int, msg string) rpcMethodHandler {
	return func(t *testing.T, _ json.RawMessage) (any, *jsonrpcError) {
		return nil, &jsonrpcError{Code: code, Message: msg}
	}
}

// --- HasVoted: read behavior, argument encoding, decoding, RPC failures ---

func TestHasVotedSendsArgsInOrderSlaIDRoundIDWatcher(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)

	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 5)))

	returned := false
	sv, err := xdr.NewScVal(xdr.ScValTypeScvBool, returned)
	if err != nil {
		t.Fatalf("NewScVal: %v", err)
	}
	m.on("simulateTransaction", func(t *testing.T, params json.RawMessage) (any, *jsonrpcError) {
		envelopeB64 := decodeTxParam(t, params)
		_, op := decodeInvokeHostFunctionOp(t, envelopeB64)
		ic := op.HostFunction.InvokeContract
		if string(ic.FunctionName) != "has_watcher_voted" {
			t.Fatalf("function = %s, want has_watcher_voted", ic.FunctionName)
		}
		if len(ic.Args) != 3 {
			t.Fatalf("arg count = %d, want 3", len(ic.Args))
		}
		if ic.Args[0].U64 == nil || uint64(*ic.Args[0].U64) != 7 {
			t.Fatalf("arg 0 (sla_id) = %v, want 7", ic.Args[0].U64)
		}
		if ic.Args[1].U64 == nil || uint64(*ic.Args[1].U64) != 9 {
			t.Fatalf("arg 1 (round_id) = %v, want 9", ic.Args[1].U64)
		}
		if ic.Args[2].Type != xdr.ScValTypeScvAddress {
			t.Fatalf("arg 2 (watcher) type = %s, want ScvAddress", ic.Args[2].Type)
		}
		gotAddr, err := ic.Args[2].Address.String()
		if err != nil {
			t.Fatalf("decoding watcher address: %v", err)
		}
		if gotAddr != kp.Address() {
			t.Fatalf("arg 2 (watcher) = %s, want %s", gotAddr, kp.Address())
		}
		return simulateSuccess(t, sv), nil
	})

	got, err := c.HasVoted(context.Background(), 7, 9)
	if err != nil {
		t.Fatalf("HasVoted: %v", err)
	}
	if got != returned {
		t.Fatalf("HasVoted = %v, want %v", got, returned)
	}
	if m.callCount("sendTransaction") != 0 {
		t.Fatal("HasVoted must never submit a transaction — it is a read")
	}
}

func TestHasVotedDecodesTrue(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))
	sv, _ := xdr.NewScVal(xdr.ScValTypeScvBool, true)
	m.on("simulateTransaction", okResult(simulateSuccess(t, sv)))

	got, err := c.HasVoted(context.Background(), 1, 1)
	if err != nil {
		t.Fatalf("HasVoted: %v", err)
	}
	if !got {
		t.Fatal("HasVoted = false, want true")
	}
}

func TestHasVotedNonBoolResultIsAnError(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))
	sv := mustU64(123) // has_watcher_voted never returns this; simulate a malformed/wrong response
	m.on("simulateTransaction", okResult(simulateSuccess(t, sv)))

	_, err := c.HasVoted(context.Background(), 1, 1)
	if err == nil {
		t.Fatal("expected an error for a non-bool result, got nil")
	}
}

func TestHasVotedPropagatesRPCTransportFailure(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))
	m.on("simulateTransaction", errResult(-32000, "rpc backend unavailable"))

	_, err := c.HasVoted(context.Background(), 1, 1)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !strings.Contains(err.Error(), "rpc backend unavailable") {
		t.Fatalf("error = %q, want it to preserve the RPC failure detail", err.Error())
	}
}

func TestHasVotedPropagatesSimulationError(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))
	m.on("simulateTransaction", okResult(protocol.SimulateTransactionResponse{
		Error: "HostError: contract trapped",
	}))

	_, err := c.HasVoted(context.Background(), 1, 1)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !strings.Contains(err.Error(), "contract trapped") {
		t.Fatalf("error = %q, want it to preserve the simulation error detail", err.Error())
	}
}

// --- SubmitCheck: invocation shape, argument/enum encoding -----------------

func TestSubmitCheckSendsExpectedInvocationAndArgumentEncoding(t *testing.T) {
	m := newMockRPC(t)
	c, kp, contractID := newTestClient(t, m)

	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 41)))

	var endpointHash [32]byte
	copy(endpointHash[:], []byte("0123456789abcdef0123456789abcdef"))

	var capturedAuthArgs xdr.ScVec
	m.on("simulateTransaction", func(t *testing.T, params json.RawMessage) (any, *jsonrpcError) {
		envelopeB64 := decodeTxParam(t, params)
		_, op := decodeInvokeHostFunctionOp(t, envelopeB64)
		ic := op.HostFunction.InvokeContract

		if string(ic.FunctionName) != "submit_check" {
			t.Fatalf("function = %s, want submit_check", ic.FunctionName)
		}
		gotContract, err := ic.ContractAddress.String()
		if err != nil {
			t.Fatalf("decoding contract address: %v", err)
		}
		if gotContract != contractID {
			t.Fatalf("contract address = %s, want %s", gotContract, contractID)
		}
		if len(ic.Args) != 5 {
			t.Fatalf("arg count = %d, want 5 (watcher, sla_id, round_id, endpoint_hash, status)", len(ic.Args))
		}

		// arg 0: watcher address
		if ic.Args[0].Type != xdr.ScValTypeScvAddress {
			t.Fatalf("arg 0 type = %s, want ScvAddress", ic.Args[0].Type)
		}
		gotWatcher, err := ic.Args[0].Address.String()
		if err != nil {
			t.Fatalf("decoding watcher address: %v", err)
		}
		if gotWatcher != kp.Address() {
			t.Fatalf("arg 0 (watcher) = %s, want %s", gotWatcher, kp.Address())
		}

		// arg 1: sla_id
		if ic.Args[1].U64 == nil || uint64(*ic.Args[1].U64) != 55 {
			t.Fatalf("arg 1 (sla_id) = %v, want 55", ic.Args[1].U64)
		}
		// arg 2: round_id
		if ic.Args[2].U64 == nil || uint64(*ic.Args[2].U64) != 3 {
			t.Fatalf("arg 2 (round_id) = %v, want 3", ic.Args[2].U64)
		}
		// arg 3: endpoint_hash
		if ic.Args[3].Type != xdr.ScValTypeScvBytes || ic.Args[3].Bytes == nil {
			t.Fatalf("arg 3 (endpoint_hash) type = %s, want ScvBytes", ic.Args[3].Type)
		}
		if got := []byte(*ic.Args[3].Bytes); string(got) != string(endpointHash[:]) {
			t.Fatalf("arg 3 (endpoint_hash) = %x, want %x", got, endpointHash)
		}
		// arg 4: status, exact contract enum representation (vec[symbol])
		if ic.Args[4].Type != xdr.ScValTypeScvVec || ic.Args[4].Vec == nil {
			t.Fatalf("arg 4 (status) type = %s, want ScvVec", ic.Args[4].Type)
		}
		statusVec := **ic.Args[4].Vec
		if len(statusVec) != 1 || statusVec[0].Sym == nil || string(*statusVec[0].Sym) != "Down" {
			t.Fatalf("arg 4 (status) = %+v, want vec[Symbol(\"Down\")]", statusVec)
		}

		capturedAuthArgs = ic.Args
		return simulateSuccessWithAuth(t, kp.Address(), contractID, "submit_check", capturedAuthArgs), nil
	})

	var sentEnvelope *xdr.TransactionV1Envelope
	m.on("sendTransaction", func(t *testing.T, params json.RawMessage) (any, *jsonrpcError) {
		envelopeB64 := decodeTxParam(t, params)
		env, op := decodeInvokeHostFunctionOp(t, envelopeB64)
		sentEnvelope = env

		// The submitted envelope must carry the same InvokeContract call —
		// prepare must not have altered the actual invocation.
		if string(op.HostFunction.InvokeContract.FunctionName) != "submit_check" {
			t.Fatalf("submitted function = %s, want submit_check", op.HostFunction.InvokeContract.FunctionName)
		}
		return protocol.SendTransactionResponse{Status: "PENDING", Hash: "deadbeef"}, nil
	})
	m.on("getTransaction", okResult(protocol.GetTransactionResponse{
		TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusSuccess},
	}))

	err := c.SubmitCheck(context.Background(), 55, 3, endpointHash, StatusDown)
	if err != nil {
		t.Fatalf("SubmitCheck: %v", err)
	}

	if sentEnvelope == nil {
		t.Fatal("sendTransaction was never called")
	}
	if len(sentEnvelope.Signatures) == 0 {
		t.Fatal("submitted transaction has no signatures — an unsigned transaction must never be submitted")
	}
	if sentEnvelope.Tx.Ext.SorobanData == nil {
		t.Fatal("submitted transaction is missing the simulated Soroban resource data — prepare step did not apply it")
	}
}

// --- Authorization / signing boundary ---------------------------------

func TestSubmitCheckAppliesSimulatedAuthEntriesBeforeSigning(t *testing.T) {
	m := newMockRPC(t)
	c, kp, contractID := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))

	var endpointHash [32]byte
	args := xdr.ScVec{
		mustAccountAddress(kp.Address()),
		mustU64(1),
		mustU64(1),
		mustBytesN32(endpointHash),
		mustCheckStatusEnum(StatusUp),
	}
	m.on("simulateTransaction", okResult(simulateSuccessWithAuth(t, kp.Address(), contractID, "submit_check", args)))

	var sentOp *xdr.InvokeHostFunctionOp
	m.on("sendTransaction", func(t *testing.T, params json.RawMessage) (any, *jsonrpcError) {
		envelopeB64 := decodeTxParam(t, params)
		_, op := decodeInvokeHostFunctionOp(t, envelopeB64)
		sentOp = op
		return protocol.SendTransactionResponse{Status: "PENDING", Hash: "aa"}, nil
	})
	m.on("getTransaction", okResult(protocol.GetTransactionResponse{
		TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusSuccess},
	}))

	if err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp); err != nil {
		t.Fatalf("SubmitCheck: %v", err)
	}

	if sentOp == nil {
		t.Fatal("sendTransaction was never called")
	}
	if len(sentOp.Auth) != 1 {
		t.Fatalf("submitted operation has %d auth entries, want 1 (the one the simulation returned)", len(sentOp.Auth))
	}
	if sentOp.Auth[0].Credentials.Type != xdr.SorobanCredentialsTypeSorobanCredentialsSourceAccount {
		t.Fatalf("auth credentials type = %s, want SourceAccount (the watcher only ever authorizes its own vote)", sentOp.Auth[0].Credentials.Type)
	}
}

func TestSubmitCheckDoesNotSubmitWhenSimulationFails(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))
	m.on("simulateTransaction", okResult(protocol.SimulateTransactionResponse{
		Error: "HostError: MissingValue",
	}))

	var endpointHash [32]byte
	err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !strings.Contains(err.Error(), "MissingValue") {
		t.Fatalf("error = %q, want it to preserve the simulation failure detail", err.Error())
	}
	if m.callCount("sendTransaction") != 0 {
		t.Fatal("a transaction must never be submitted after a failed simulation — that would mean an unauthorized/unprepared tx reaching the network")
	}
}

func TestSubmitCheckDoesNotSubmitOnSimulationRPCTransportFailure(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))
	m.on("simulateTransaction", errResult(-32000, "connection reset"))

	var endpointHash [32]byte
	err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if !strings.Contains(err.Error(), "connection reset") {
		t.Fatalf("error = %q, want it to preserve the RPC transport failure detail", err.Error())
	}
	if m.callCount("sendTransaction") != 0 {
		t.Fatal("a transaction must never be submitted when simulation itself failed to reach the RPC server")
	}
}

// --- Transaction submission / rejection --------------------------------

func TestSubmitCheckRejectedBeforeInclusionIsNotTreatedAsSuccess(t *testing.T) {
	m := newMockRPC(t)
	c, kp, contractID := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))

	var endpointHash [32]byte
	args := xdr.ScVec{mustAccountAddress(kp.Address()), mustU64(1), mustU64(1), mustBytesN32(endpointHash), mustCheckStatusEnum(StatusUp)}
	m.on("simulateTransaction", okResult(simulateSuccessWithAuth(t, kp.Address(), contractID, "submit_check", args)))
	m.on("sendTransaction", okResult(protocol.SendTransactionResponse{
		Status:         "ERROR",
		ErrorResultXDR: "AAAAAAAAAGT/////AAAAAQ==",
		Hash:           "deadbeef",
	}))

	err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp)
	if err == nil {
		t.Fatal("expected an error for a rejected submission, got nil (a rejected tx must never be reported as success)")
	}
	if !strings.Contains(err.Error(), "AAAAAAAAAGT") {
		t.Fatalf("error = %q, want it to preserve the ErrorResultXDR detail", err.Error())
	}
	if m.callCount("getTransaction") != 0 {
		t.Fatal("a submission rejected before inclusion must not be polled for confirmation")
	}
}

func TestSubmitCheckPollTerminalFailureIsAnError(t *testing.T) {
	m := newMockRPC(t)
	c, kp, contractID := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))

	var endpointHash [32]byte
	args := xdr.ScVec{mustAccountAddress(kp.Address()), mustU64(1), mustU64(1), mustBytesN32(endpointHash), mustCheckStatusEnum(StatusUp)}
	m.on("simulateTransaction", okResult(simulateSuccessWithAuth(t, kp.Address(), contractID, "submit_check", args)))
	m.on("sendTransaction", okResult(protocol.SendTransactionResponse{Status: "PENDING", Hash: "deadbeef"}))
	m.on("getTransaction", okResult(protocol.GetTransactionResponse{
		TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusFailed},
	}))

	err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp)
	if err == nil {
		t.Fatal("expected an error for a FAILED terminal status, got nil — PollTransaction returns FAILED without a transport error, and the caller must still check it")
	}
	if !strings.Contains(err.Error(), "FAILED") {
		t.Fatalf("error = %q, want it to mention the FAILED status", err.Error())
	}
}

func TestSubmitCheckPollTransientNotFoundThenSuccess(t *testing.T) {
	m := newMockRPC(t)
	c, kp, contractID := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))

	var endpointHash [32]byte
	args := xdr.ScVec{mustAccountAddress(kp.Address()), mustU64(1), mustU64(1), mustBytesN32(endpointHash), mustCheckStatusEnum(StatusUp)}
	m.on("simulateTransaction", okResult(simulateSuccessWithAuth(t, kp.Address(), contractID, "submit_check", args)))
	m.on("sendTransaction", okResult(protocol.SendTransactionResponse{Status: "PENDING", Hash: "deadbeef"}))

	m.onSequence("getTransaction",
		okResult(protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound}}),
		okResult(protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound}}),
		okResult(protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusSuccess}}),
	)

	if err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp); err != nil {
		t.Fatalf("SubmitCheck: %v", err)
	}
	if got := m.callCount("getTransaction"); got < 3 {
		t.Fatalf("getTransaction called %d times, want at least 3 (poll must retry through the transient NOT_FOUND)", got)
	}
}

func TestSubmitCheckPollTimeoutDoesNotReportSuccess(t *testing.T) {
	m := newMockRPC(t)
	c, kp, contractID := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))

	var endpointHash [32]byte
	args := xdr.ScVec{mustAccountAddress(kp.Address()), mustU64(1), mustU64(1), mustBytesN32(endpointHash), mustCheckStatusEnum(StatusUp)}
	m.on("simulateTransaction", okResult(simulateSuccessWithAuth(t, kp.Address(), contractID, "submit_check", args)))
	m.on("sendTransaction", okResult(protocol.SendTransactionResponse{Status: "PENDING", Hash: "deadbeef"}))
	// Never reaches a terminal state.
	m.on("getTransaction", okResult(protocol.GetTransactionResponse{
		TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound},
	}))

	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()

	err := c.SubmitCheck(ctx, 1, 1, endpointHash, StatusUp)
	if err == nil {
		t.Fatal("expected a timeout error, got nil — a transaction that never confirms must never be reported as successful")
	}
}

func TestSubmitCheckMalformedSimulationResponseIsAnError(t *testing.T) {
	m := newMockRPC(t)
	c, kp, _ := newTestClient(t, m)
	m.on("getLedgerEntries", okResult(accountLedgerEntry(t, kp.Address(), 1)))
	m.on("simulateTransaction", okResult(protocol.SimulateTransactionResponse{
		TransactionDataXDR: "not-valid-base64-xdr",
	}))

	var endpointHash [32]byte
	err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp)
	if err == nil {
		t.Fatal("expected an error for a malformed TransactionDataXDR, got nil")
	}
	if m.callCount("sendTransaction") != 0 {
		t.Fatal("must never submit after failing to decode the simulated transaction data")
	}
}

func TestSubmitCheckSourceAccountLoadFailureAbortsBeforeSimulation(t *testing.T) {
	m := newMockRPC(t)
	c, _, _ := newTestClient(t, m)
	m.on("getLedgerEntries", errResult(-32000, "ledger entry not found"))

	var endpointHash [32]byte
	err := c.SubmitCheck(context.Background(), 1, 1, endpointHash, StatusUp)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if m.callCount("simulateTransaction") != 0 {
		t.Fatal("must not simulate without a loaded source account")
	}
}
