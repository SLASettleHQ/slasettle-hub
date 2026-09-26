package contract

// A minimal, deterministic JSON-RPC 2.0 test double for the Stellar RPC
// server this package's rpcclient.Client talks to over HTTP. It exists so
// contract_rpc_test.go can exercise the package's real network-boundary code
// (simulate -> prepare -> sign -> submit -> poll) against known request/
// response XDR without a live Testnet connection.
//
// IMPORTANT: this mock proves the package's own logic is correct given
// whatever the RPC server returns. It does not, and cannot, prove that a
// real deployed Soroban RPC server or the real watcher_registry contract
// actually behaves this way — see the "Live Testnet verification" note in
// this package's test coverage report.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	protocol "github.com/stellar/go-stellar-sdk/protocols/rpc"
	"github.com/stellar/go-stellar-sdk/xdr"
)

type jsonrpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type jsonrpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// rpcMethodHandler produces either a result value (marshaled into the
// response's "result") or an error. Returning both nil means "result: null".
type rpcMethodHandler func(t *testing.T, params json.RawMessage) (result any, rpcErr *jsonrpcError)

// mockRPC is an httptest-backed Stellar RPC double. Each call to a
// registered method is recorded, in order, so tests can assert not just
// what the package sent but how many times and in what sequence.
type mockRPC struct {
	t        *testing.T
	server   *httptest.Server
	mu       sync.Mutex
	handlers map[string]rpcMethodHandler
	calls    map[string][]json.RawMessage
}

func newMockRPC(t *testing.T) *mockRPC {
	m := &mockRPC{
		t:        t,
		handlers: make(map[string]rpcMethodHandler),
		calls:    make(map[string][]json.RawMessage),
	}
	m.server = httptest.NewServer(http.HandlerFunc(m.serveHTTP))
	t.Cleanup(m.server.Close)
	return m
}

func (m *mockRPC) URL() string { return m.server.URL }

// on registers (or replaces) the handler for a JSON-RPC method name.
func (m *mockRPC) on(method string, h rpcMethodHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers[method] = h
}

// onSequence calls a different handler on each successive call to method,
// holding on the last one once the sequence is exhausted. Used to test
// transient-failure-then-success polling behavior.
func (m *mockRPC) onSequence(method string, hs ...rpcMethodHandler) {
	i := 0
	m.on(method, func(t *testing.T, params json.RawMessage) (any, *jsonrpcError) {
		m.mu.Lock()
		idx := i
		if i < len(hs)-1 {
			i++
		}
		m.mu.Unlock()
		return hs[idx](t, params)
	})
}

func (m *mockRPC) callCount(method string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.calls[method])
}

func (m *mockRPC) lastParams(method string) json.RawMessage {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := m.calls[method]
	if len(c) == 0 {
		return nil
	}
	return c[len(c)-1]
}

func (m *mockRPC) serveHTTP(w http.ResponseWriter, r *http.Request) {
	var req jsonrpcRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	m.mu.Lock()
	m.calls[req.Method] = append(m.calls[req.Method], req.Params)
	h, ok := m.handlers[req.Method]
	m.mu.Unlock()

	resp := map[string]any{"jsonrpc": "2.0", "id": json.RawMessage(req.ID)}
	if !ok {
		resp["error"] = jsonrpcError{Code: -32601, Message: fmt.Sprintf("method not registered in mock: %s", req.Method)}
	} else {
		result, rpcErr := h(m.t, req.Params)
		if rpcErr != nil {
			resp["error"] = rpcErr
		} else {
			resp["result"] = result
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		m.t.Fatalf("mockRPC: encoding response: %v", err)
	}
}

// --- response builders --------------------------------------------------

func mustMarshalBase64(t *testing.T, v any) string {
	t.Helper()
	s, err := xdr.MarshalBase64(v)
	if err != nil {
		t.Fatalf("MarshalBase64: %v", err)
	}
	return s
}

// accountLedgerEntry builds the getLedgerEntries response LoadAccount
// expects for a single account, with the given sequence number.
func accountLedgerEntry(t *testing.T, address string, seq int64) protocol.GetLedgerEntriesResponse {
	t.Helper()
	accountID, err := xdr.AddressToAccountId(address)
	if err != nil {
		t.Fatalf("AddressToAccountId: %v", err)
	}
	entryData := xdr.LedgerEntryData{
		Type: xdr.LedgerEntryTypeAccount,
		Account: &xdr.AccountEntry{
			AccountId:  accountID,
			SeqNum:     xdr.SequenceNumber(seq),
			Thresholds: xdr.Thresholds{0, 0, 0, 0},
		},
	}
	return protocol.GetLedgerEntriesResponse{
		Entries: []protocol.LedgerEntryResult{
			{DataXDR: mustMarshalBase64(t, entryData), LastModifiedLedger: 1},
		},
		LatestLedger: 100,
	}
}

// zeroSorobanTransactionData is a minimal, structurally valid
// SorobanTransactionData: an empty footprint and no resource fee. Good
// enough for tests that don't care about the specific resource numbers.
func zeroSorobanTransactionDataXDR(t *testing.T) string {
	t.Helper()
	return mustMarshalBase64(t, xdr.SorobanTransactionData{})
}

// simulateSuccess builds a SimulateTransactionResponse with the given
// return-value ScVal (for reads) and no required auth (for ops that don't
// need auth beyond the source account's own signature).
func simulateSuccess(t *testing.T, returnValue xdr.ScVal) protocol.SimulateTransactionResponse {
	t.Helper()
	xdrStr := mustMarshalBase64(t, returnValue)
	return protocol.SimulateTransactionResponse{
		TransactionDataXDR: zeroSorobanTransactionDataXDR(t),
		Results: []protocol.SimulateHostFunctionResult{
			{ReturnValueXDR: &xdrStr},
		},
		LatestLedger:   100,
		MinResourceFee: 100,
	}
}

// simulateSuccessWithAuth is like simulateSuccess but also returns one
// SorobanAuthorizationEntry authorizing the invocation via the source
// account's own signature (SorobanCredentialsSourceAccount) — the shape the
// real network would return for submit_check, where the watcher only ever
// authorizes its own vote.
func simulateSuccessWithAuth(t *testing.T, watcherAddress string, contractID, function string, args xdr.ScVec) protocol.SimulateTransactionResponse {
	t.Helper()
	entry := xdr.SorobanAuthorizationEntry{
		Credentials: xdr.SorobanCredentials{Type: xdr.SorobanCredentialsTypeSorobanCredentialsSourceAccount},
		RootInvocation: xdr.SorobanAuthorizedInvocation{
			Function: xdr.SorobanAuthorizedFunction{
				Type: xdr.SorobanAuthorizedFunctionTypeSorobanAuthorizedFunctionTypeContractFn,
				ContractFn: &xdr.InvokeContractArgs{
					ContractAddress: mustContractScAddress(contractID),
					FunctionName:    xdr.ScSymbol(function),
					Args:            args,
				},
			},
		},
	}
	authXDR := mustMarshalBase64(t, entry)
	return protocol.SimulateTransactionResponse{
		TransactionDataXDR: zeroSorobanTransactionDataXDR(t),
		Results: []protocol.SimulateHostFunctionResult{
			{AuthXDR: &[]string{authXDR}},
		},
		LatestLedger:   100,
		MinResourceFee: 100,
	}
}

func toJSONRawMessage(t *testing.T, v any) json.RawMessage {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}

// decodeTxParam extracts the base64 transaction envelope XDR that the
// package sent as the "transaction" field of a simulateTransaction or
// sendTransaction call.
func decodeTxParam(t *testing.T, params json.RawMessage) string {
	t.Helper()
	var p struct {
		Transaction string `json:"transaction"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		t.Fatalf("decoding tx param: %v", err)
	}
	if p.Transaction == "" {
		t.Fatal("tx param has no transaction field")
	}
	return p.Transaction
}

// decodeEnvelope fully decodes a base64 TransactionEnvelope XDR, as sent to
// simulateTransaction or sendTransaction, and returns its single
// InvokeHostFunction operation for inspection.
func decodeInvokeHostFunctionOp(t *testing.T, envelopeB64 string) (*xdr.TransactionV1Envelope, *xdr.InvokeHostFunctionOp) {
	t.Helper()
	var env xdr.TransactionEnvelope
	if err := xdr.SafeUnmarshalBase64(envelopeB64, &env); err != nil {
		t.Fatalf("decoding TransactionEnvelope: %v", err)
	}
	if env.V1 == nil {
		t.Fatalf("envelope is not V1 (type=%s)", env.Type)
	}
	if len(env.V1.Tx.Operations) != 1 {
		t.Fatalf("expected exactly 1 operation, got %d", len(env.V1.Tx.Operations))
	}
	op := env.V1.Tx.Operations[0].Body.InvokeHostFunctionOp
	if op == nil {
		t.Fatal("operation is not InvokeHostFunctionOp")
	}
	if op.HostFunction.InvokeContract == nil {
		t.Fatal("host function is not InvokeContract")
	}
	return env.V1, op
}
