// Package contract talks to the watcher_registry Soroban contract: reads
// whether this watcher has already voted in the current round, and builds,
// signs, and submits the submit_check transaction when it hasn't.
//
// Written against the real, installed github.com/stellar/go-stellar-sdk
// source (v0.7.3; go build, go vet and the tests pass), not just its docs or general Soroban
// tooling conventions. In particular:
//   - xdr.ScVec is a plain []xdr.ScVal — there is no NewScVec constructor.
//   - Addresses are built via xdr.AddressToAccountId (G... accounts) or by
//     strkey-decoding a contract ID into xdr.ContractId (C... contracts) and
//     wrapping either in an xdr.ScAddress — there is no single
//     AddressToScAddress that handles both. See txnbuild's own
//     NewPaymentToContract (invoke_host_function.go) for the same pattern.
//   - *rpcclient.Client has LoadAccount (not GetAccount), which returns a
//     ready-to-use txnbuild.Account.
//   - protocol.Simulate/SendTransactionRequest.Transaction is the base64
//     envelope XDR string (Transaction.Base64()), not the object itself.
//   - protocol.SimulateHostFunctionResult's return value XDR is
//     ReturnValueXDR (*string), not XDR.
//   - This SDK version has no PrepareTransaction convenience — applying a
//     simulation's footprint/resource fee/auth onto the transaction has to
//     be done by hand: decode TransactionDataXDR into
//     xdr.SorobanTransactionData and each result's AuthXDR into
//     []xdr.SorobanAuthorizationEntry, set them on a fresh
//     InvokeHostFunction, and rebuild the transaction (txnbuild.NewTransaction
//     picks the soroban resource fee up from that operation's Ext
//     automatically — see NewTransaction in txnbuild/transaction.go).
//   - PollTransaction returns (protocol.GetTransactionResponse, error); the
//     error is only for context/transport failures; a terminal FAILED status
//     comes back as a normal (non-error) response and must be checked.
//   - txnbuild.TransactionParams.IncrementSequenceNum defaults to false,
//     which makes NewTransaction use the loaded account's *current*
//     sequence number verbatim instead of current+1 — a guaranteed
//     txBadSeq on every submission, since every real Stellar tx must use
//     the account's last-used sequence plus one. This wasn't caught by any
//     mocked-RPC test (none of them decode the built tx's SeqNum), only by
//     running this against the live network for the first time: both
//     getSourceAccount call sites now set IncrementSequenceNum: true.
//
// Still worth double-checking once real events can be observed: whether
// CheckStatus's vec-wrapped-symbol encoding in mustCheckStatusEnum actually
// matches how the deployed contract's #[contracttype] enum derives to XDR
// (see the indexer's decode.ts for the parallel concern on the reading
// side) — that part is unchanged from before and was never a compile error,
// only an assumption about the contract's own encoding.
package contract

import (
	"context"
	"fmt"

	"github.com/SLASettleHQ/slasettle-hub/watcher/internal/endpoint"
	"github.com/SLASettleHQ/slasettle-hub/watcher/internal/retry"
	"github.com/stellar/go-stellar-sdk/clients/rpcclient"
	"github.com/stellar/go-stellar-sdk/keypair"
	protocol "github.com/stellar/go-stellar-sdk/protocols/rpc"
	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/txnbuild"
	"github.com/stellar/go-stellar-sdk/xdr"
)

type CheckStatus string

const (
	StatusUp   CheckStatus = "Up"
	StatusDown CheckStatus = "Down"
)

type Client struct {
	rpc               *rpcclient.Client
	networkPassphrase string
	registryContract  string
	slaVaultContract  string
	watcherKeypair    *keypair.Full
	retryOpts         retry.Options
}

func NewClient(rpcURL, networkPassphrase, registryContractID, slaVaultContractID, watcherSecretKey string) (*Client, error) {
	kp, err := keypair.ParseFull(watcherSecretKey)
	if err != nil {
		return nil, fmt.Errorf("parsing WATCHER_SECRET_KEY: %w", err)
	}

	return &Client{
		rpc:               rpcclient.NewClient(rpcURL, nil),
		networkPassphrase: networkPassphrase,
		registryContract:  registryContractID,
		slaVaultContract:  slaVaultContractID,
		watcherKeypair:    kp,
		retryOpts:         retry.DefaultOptions(),
	}, nil
}

// EndpointHash computes the v0.2 endpoint commitment hash for targetURL —
// see internal/endpoint for the exact algorithm, which must stay
// byte-for-byte identical to the TypeScript SDK's and to
// SLASettle-contract-spec.md section 3. Returns an error if targetURL isn't
// (once ASCII-trimmed) an absolute http(s) URL.
func EndpointHash(targetURL string) ([32]byte, error) {
	return endpoint.ComputeEndpointHash(targetURL)
}

// HasVoted reads watcher_registry.has_watcher_voted for this watcher's own
// address, so the daemon can skip submitting a transaction that would just
// fail with DuplicateCheck — cheaper and cleaner than submitting and
// handling the error.
func (c *Client) HasVoted(ctx context.Context, slaID, roundID uint64) (bool, error) {
	args := xdr.ScVec{
		mustU64(slaID),
		mustU64(roundID),
		mustAccountAddress(c.watcherKeypair.Address()),
	}

	result, err := c.simulateReadOnly(ctx, c.registryContract, "has_watcher_voted", args)
	if err != nil {
		return false, err
	}

	b, ok := result.(bool)
	if !ok {
		return false, fmt.Errorf("has_watcher_voted returned a non-bool result: %#v", result)
	}
	return b, nil
}

// GetCurrentRound reads watcher_registry.get_current_round — the contract's
// authoritative round, which submit_check validates round_id against. Used
// in place of a locally-derived round so a submission's round_id always
// matches what the contract will accept (see internal/round for the
// sleep-scheduling-only local clock use that remains).
func (c *Client) GetCurrentRound(ctx context.Context) (uint64, error) {
	result, err := c.simulateReadOnly(ctx, c.registryContract, "get_current_round", xdr.ScVec{})
	if err != nil {
		return 0, err
	}
	round, ok := result.(uint64)
	if !ok {
		return 0, fmt.Errorf("get_current_round returned a non-u64 result: %#v", result)
	}
	return round, nil
}

// GetSlaEndpointHash reads sla_vault.get_sla for slaID and returns its
// committed endpoint_hash. Used for the pre-flight check in section 14 of
// the v0.2 integration: the daemon must never spend a submission on a
// round whose vote would be partitioned under an endpoint hash that
// doesn't match what the SLA actually committed to.
func (c *Client) GetSlaEndpointHash(ctx context.Context, slaID uint64) ([32]byte, error) {
	var zero [32]byte
	args := xdr.ScVec{mustU64(slaID)}
	result, err := c.simulateReadOnly(ctx, c.slaVaultContract, "get_sla", args)
	if err != nil {
		return zero, err
	}
	record, ok := result.(map[string]interface{})
	if !ok {
		return zero, fmt.Errorf("get_sla returned a non-struct result: %#v", result)
	}
	raw, ok := record["endpoint_hash"]
	if !ok {
		return zero, fmt.Errorf("get_sla result is missing the endpoint_hash field")
	}
	b, ok := raw.([]byte)
	if !ok || len(b) != 32 {
		return zero, fmt.Errorf("get_sla endpoint_hash is %#v, expected 32 bytes", raw)
	}
	var hash [32]byte
	copy(hash[:], b)
	return hash, nil
}

// SubmitCheck builds, signs, and submits submit_check for this watcher's
// own vote, then polls until the transaction reaches a final state. Auth
// here is straightforward compared to sla_vault's cross-contract calls —
// the watcher only ever authorizes its own vote, never anyone else's
// funds, so there's no multi-party auth entry assembly needed.
func (c *Client) SubmitCheck(ctx context.Context, slaID, roundID uint64, endpointHash [32]byte, status CheckStatus) error {
	args := xdr.ScVec{
		mustAccountAddress(c.watcherKeypair.Address()),
		mustU64(slaID),
		mustU64(roundID),
		mustBytesN32(endpointHash),
		mustCheckStatusEnum(status),
	}

	invokeOp := &txnbuild.InvokeHostFunction{
		HostFunction:  buildInvokeContractHostFunction(c.registryContract, "submit_check", args),
		SourceAccount: c.watcherKeypair.Address(),
	}

	preparedOp, err := c.simulateAndPrepare(ctx, invokeOp)
	if err != nil {
		return fmt.Errorf("simulating submit_check: %w", err)
	}

	sourceAccount, err := c.getSourceAccount(ctx)
	if err != nil {
		return fmt.Errorf("loading source account: %w", err)
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        sourceAccount,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{preparedOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(30)},
	})
	if err != nil {
		return fmt.Errorf("building transaction: %w", err)
	}

	signedTx, err := tx.Sign(c.networkPassphrase, c.watcherKeypair)
	if err != nil {
		return fmt.Errorf("signing submit_check: %w", err)
	}

	return c.submitAndPoll(ctx, signedTx)
}

// The helpers below (getSourceAccount, simulateReadOnly, simulateAndPrepare,
// submitAndPoll, buildInvokeContractHostFunction, and the mustXxx ScVal
// builders) implement the simulate -> prepare -> sign -> submit -> poll
// shape against the real go-stellar-sdk API surface (see the file-level comment).

func (c *Client) getSourceAccount(ctx context.Context) (txnbuild.Account, error) {
	var account txnbuild.Account
	err := retry.Do(ctx, c.retryOpts, func() error {
		a, err := c.rpc.LoadAccount(ctx, c.watcherKeypair.Address())
		if err != nil {
			return err
		}
		account = a
		return nil
	})
	return account, err
}

// simulate runs a read-only or pre-signing simulation of a single
// InvokeHostFunction operation and returns the raw RPC response.
func (c *Client) simulate(ctx context.Context, op *txnbuild.InvokeHostFunction) (protocol.SimulateTransactionResponse, error) {
	sourceAccount, err := c.getSourceAccount(ctx)
	if err != nil {
		return protocol.SimulateTransactionResponse{}, err
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        sourceAccount,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{op},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(30)},
	})
	if err != nil {
		return protocol.SimulateTransactionResponse{}, err
	}

	txXDR, err := tx.Base64()
	if err != nil {
		return protocol.SimulateTransactionResponse{}, fmt.Errorf("encoding transaction for simulation: %w", err)
	}

	var sim protocol.SimulateTransactionResponse
	err = retry.Do(ctx, c.retryOpts, func() error {
		s, err := c.rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: txXDR})
		if err != nil {
			return err
		}
		sim = s
		return nil
	})
	if err != nil {
		return protocol.SimulateTransactionResponse{}, err
	}
	if sim.Error != "" {
		return protocol.SimulateTransactionResponse{}, fmt.Errorf("simulation error: %s", sim.Error)
	}
	return sim, nil
}

func (c *Client) simulateReadOnly(ctx context.Context, contractID, functionName string, args xdr.ScVec) (interface{}, error) {
	op := &txnbuild.InvokeHostFunction{
		HostFunction:  buildInvokeContractHostFunction(contractID, functionName, args),
		SourceAccount: c.watcherKeypair.Address(),
	}

	sim, err := c.simulate(ctx, op)
	if err != nil {
		return nil, err
	}
	if len(sim.Results) == 0 || sim.Results[0].ReturnValueXDR == nil {
		return nil, fmt.Errorf("%s: simulation returned no result", functionName)
	}

	return decodeScVal(*sim.Results[0].ReturnValueXDR)
}

// simulateAndPrepare simulates op, then returns a copy of it with the
// simulated footprint/resource fee (Ext.SorobanData) and authorization
// entries (Auth) applied — the manual equivalent of this SDK's missing
// PrepareTransaction convenience.
func (c *Client) simulateAndPrepare(ctx context.Context, op *txnbuild.InvokeHostFunction) (*txnbuild.InvokeHostFunction, error) {
	sim, err := c.simulate(ctx, op)
	if err != nil {
		return nil, err
	}

	var sorobanData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(sim.TransactionDataXDR, &sorobanData); err != nil {
		return nil, fmt.Errorf("decoding simulated transaction data: %w", err)
	}

	var auth []xdr.SorobanAuthorizationEntry
	if len(sim.Results) > 0 && sim.Results[0].AuthXDR != nil {
		auth = make([]xdr.SorobanAuthorizationEntry, len(*sim.Results[0].AuthXDR))
		for i, entryXDR := range *sim.Results[0].AuthXDR {
			if err := xdr.SafeUnmarshalBase64(entryXDR, &auth[i]); err != nil {
				return nil, fmt.Errorf("decoding simulated auth entry %d: %w", i, err)
			}
		}
	}

	prepared := *op
	prepared.Auth = auth
	prepared.Ext = xdr.TransactionExt{
		V:           1,
		SorobanData: &sorobanData,
	}
	return &prepared, nil
}

func (c *Client) submitAndPoll(ctx context.Context, tx *txnbuild.Transaction) error {
	txXDR, err := tx.Base64()
	if err != nil {
		return fmt.Errorf("encoding signed transaction: %w", err)
	}

	var sendResp protocol.SendTransactionResponse
	err = retry.Do(ctx, c.retryOpts, func() error {
		r, err := c.rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: txXDR})
		if err != nil {
			return err
		}
		sendResp = r
		return nil
	})
	if err != nil {
		return err
	}
	// SendTransactionResponse.Status uses stellar-core's TXStatus* strings
	// (protocols/stellarcore.TXStatusError == "ERROR"), a different set from
	// GetTransactionResponse's protocol.TransactionStatus* used below —
	// compared as a literal here rather than importing that package for one
	// constant.
	if sendResp.Status == "ERROR" {
		return fmt.Errorf("submit_check rejected before inclusion: %s", sendResp.ErrorResultXDR)
	}

	var result protocol.GetTransactionResponse
	err = retry.Do(ctx, c.retryOpts, func() error {
		r, err := c.rpc.PollTransaction(ctx, sendResp.Hash)
		if err != nil {
			return err
		}
		result = r
		return nil
	})
	if err != nil {
		return fmt.Errorf("polling submit_check %s: %w", sendResp.Hash, err)
	}
	if result.Status != protocol.TransactionStatusSuccess {
		return fmt.Errorf("submit_check %s finished with status %s", sendResp.Hash, result.Status)
	}
	return nil
}

func buildInvokeContractHostFunction(contractID, functionName string, args xdr.ScVec) xdr.HostFunction {
	return xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
		InvokeContract: &xdr.InvokeContractArgs{
			ContractAddress: mustContractScAddress(contractID),
			FunctionName:    xdr.ScSymbol(functionName),
			Args:            args,
		},
	}
}

func mustU64(v uint64) xdr.ScVal {
	sv, err := xdr.NewScVal(xdr.ScValTypeScvU64, xdr.Uint64(v))
	if err != nil {
		panic(fmt.Sprintf("encoding u64 %d: %v", v, err))
	}
	return sv
}

func mustBytesN32(b [32]byte) xdr.ScVal {
	sv, err := xdr.NewScVal(xdr.ScValTypeScvBytes, xdr.ScBytes(b[:]))
	if err != nil {
		panic(fmt.Sprintf("encoding bytes32: %v", err))
	}
	return sv
}

// mustAccountAddress encodes a G... Stellar account address as an
// ScVal::Address. The watcher only ever passes its own account address, so
// this deliberately doesn't need to also handle C... contract addresses —
// see mustContractScAddress for those.
func mustAccountAddress(strkeyAddress string) xdr.ScVal {
	accountID, err := xdr.AddressToAccountId(strkeyAddress)
	if err != nil {
		panic(fmt.Sprintf("encoding account address %s: %v", strkeyAddress, err))
	}
	sv, err := xdr.NewScVal(xdr.ScValTypeScvAddress, xdr.ScAddress{
		Type:      xdr.ScAddressTypeScAddressTypeAccount,
		AccountId: &accountID,
	})
	if err != nil {
		panic(fmt.Sprintf("wrapping account address ScVal: %v", err))
	}
	return sv
}

// mustContractScAddress builds the ScAddress for a C... contract ID, as
// used by txnbuild's own NewPaymentToContract for the same purpose.
func mustContractScAddress(contractID string) xdr.ScAddress {
	decoded, err := strkey.Decode(strkey.VersionByteContract, contractID)
	if err != nil {
		panic(fmt.Sprintf("encoding contract address %s: %v", contractID, err))
	}
	var id xdr.ContractId
	copy(id[:], decoded)
	return xdr.ScAddress{
		Type:       xdr.ScAddressTypeScAddressTypeContract,
		ContractId: &id,
	}
}

// mustCheckStatusEnum encodes the CheckStatus enum the same way the
// contract's #[contracttype] enum derives to XDR — as a vec whose first
// element is the variant's symbol name. This specific encoding is the part
// most worth double-checking once real events can be observed (see the
// indexer's decode.ts for the parallel concern on the reading side).
func mustCheckStatusEnum(status CheckStatus) xdr.ScVal {
	symbol, err := xdr.NewScVal(xdr.ScValTypeScvSymbol, xdr.ScSymbol(status))
	if err != nil {
		panic(fmt.Sprintf("encoding CheckStatus %s: %v", status, err))
	}
	vec := xdr.ScVec{symbol}
	sv, err := xdr.NewScVal(xdr.ScValTypeScvVec, &vec)
	if err != nil {
		panic(fmt.Sprintf("wrapping CheckStatus ScVal: %v", err))
	}
	return sv
}

// decodeScVal decodes a base64-encoded ScVal XDR string into a native Go
// value, covering the types this daemon actually reads results for: the
// bool from has_watcher_voted, the u64 from get_current_round, the struct
// (as a map[string]interface{}) and its endpoint_hash ([]byte) field from
// get_sla, plus other simple scalars for robustness against future read
// calls.
func decodeScVal(base64XDR string) (interface{}, error) {
	var scv xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(base64XDR, &scv); err != nil {
		return nil, fmt.Errorf("decoding ScVal XDR: %w", err)
	}
	return decodeScValNative(scv)
}

// decodeScValNative is decodeScVal's recursive core, operating on an
// already-decoded xdr.ScVal rather than base64 — needed so map entries can
// be decoded without re-marshaling/unmarshaling each one.
func decodeScValNative(scv xdr.ScVal) (interface{}, error) {
	switch scv.Type {
	case xdr.ScValTypeScvBytes:
		if scv.Bytes == nil {
			return nil, fmt.Errorf("scvBytes with no value")
		}
		return []byte(*scv.Bytes), nil
	case xdr.ScValTypeScvMap:
		if scv.Map == nil {
			return nil, fmt.Errorf("scvMap with no value")
		}
		record := make(map[string]interface{}, len(**scv.Map))
		for _, entry := range **scv.Map {
			if entry.Key.Type != xdr.ScValTypeScvSymbol || entry.Key.Sym == nil {
				return nil, fmt.Errorf("scvMap entry key is %s, expected a Symbol (struct field name)", entry.Key.Type)
			}
			val, err := decodeScValNative(entry.Val)
			if err != nil {
				return nil, fmt.Errorf("decoding map field %q: %w", *entry.Key.Sym, err)
			}
			record[string(*entry.Key.Sym)] = val
		}
		return record, nil
	case xdr.ScValTypeScvVoid:
		return nil, nil
	case xdr.ScValTypeScvBool:
		if scv.B == nil {
			return nil, fmt.Errorf("scvBool with no value")
		}
		return *scv.B, nil
	case xdr.ScValTypeScvU32:
		if scv.U32 == nil {
			return nil, fmt.Errorf("scvU32 with no value")
		}
		return uint32(*scv.U32), nil
	case xdr.ScValTypeScvI32:
		if scv.I32 == nil {
			return nil, fmt.Errorf("scvI32 with no value")
		}
		return int32(*scv.I32), nil
	case xdr.ScValTypeScvU64:
		if scv.U64 == nil {
			return nil, fmt.Errorf("scvU64 with no value")
		}
		return uint64(*scv.U64), nil
	case xdr.ScValTypeScvI64:
		if scv.I64 == nil {
			return nil, fmt.Errorf("scvI64 with no value")
		}
		return int64(*scv.I64), nil
	case xdr.ScValTypeScvSymbol:
		if scv.Sym == nil {
			return nil, fmt.Errorf("scvSymbol with no value")
		}
		return string(*scv.Sym), nil
	case xdr.ScValTypeScvString:
		if scv.Str == nil {
			return nil, fmt.Errorf("scvString with no value")
		}
		return string(*scv.Str), nil
	case xdr.ScValTypeScvAddress:
		if scv.Address == nil {
			return nil, fmt.Errorf("scvAddress with no value")
		}
		address, err := scv.Address.String()
		if err != nil {
			return nil, fmt.Errorf("decoding ScAddress: %w", err)
		}
		return address, nil
	default:
		return nil, fmt.Errorf("decodeScVal: unhandled ScVal type %s", scv.Type)
	}
}
