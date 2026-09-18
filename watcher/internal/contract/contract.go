// Package contract talks to the watcher_registry Soroban contract: reads
// whether this watcher has already voted in the current round, and builds,
// signs, and submits the submit_check transaction when it hasn't.
//
// Verified against the real, installed github.com/stellar/go-stellar-sdk
// v0.7.2 source (go.mod's GOMODCACHE), not just its docs or general Soroban
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
	"crypto/sha256"
	"fmt"

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
	watcherKeypair    *keypair.Full
}

func NewClient(rpcURL, networkPassphrase, registryContractID, watcherSecretKey string) (*Client, error) {
	kp, err := keypair.ParseFull(watcherSecretKey)
	if err != nil {
		return nil, fmt.Errorf("parsing WATCHER_SECRET_KEY: %w", err)
	}

	return &Client{
		rpc:               rpcclient.NewClient(rpcURL, nil),
		networkPassphrase: networkPassphrase,
		registryContract:  registryContractID,
		watcherKeypair:    kp,
	}, nil
}

// EndpointHash matches the contract's endpoint_hash: BytesN<32> parameter —
// a plain sha256 of the target URL, so a dispute can later confirm which
// endpoint this watcher actually checked, cross-referenced against the
// SLA's config. This daemon does not validate the hash against anything
// itself; see the contract spec for why that check is deliberately not
// this daemon's job.
func EndpointHash(targetURL string) [32]byte {
	return sha256.Sum256([]byte(targetURL))
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

	result, err := c.simulateReadOnly(ctx, "has_watcher_voted", args)
	if err != nil {
		return false, err
	}

	b, ok := result.(bool)
	if !ok {
		return false, fmt.Errorf("has_watcher_voted returned a non-bool result: %#v", result)
	}
	return b, nil
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
		SourceAccount: sourceAccount,
		Operations:    []txnbuild.Operation{preparedOp},
		BaseFee:       txnbuild.MinBaseFee,
		Preconditions: txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(30)},
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
// shape against the real v0.7.2 API surface (see the file-level comment).

func (c *Client) getSourceAccount(ctx context.Context) (txnbuild.Account, error) {
	return c.rpc.LoadAccount(ctx, c.watcherKeypair.Address())
}

// simulate runs a read-only or pre-signing simulation of a single
// InvokeHostFunction operation and returns the raw RPC response.
func (c *Client) simulate(ctx context.Context, op *txnbuild.InvokeHostFunction) (protocol.SimulateTransactionResponse, error) {
	sourceAccount, err := c.getSourceAccount(ctx)
	if err != nil {
		return protocol.SimulateTransactionResponse{}, err
	}

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount: sourceAccount,
		Operations:    []txnbuild.Operation{op},
		BaseFee:       txnbuild.MinBaseFee,
		Preconditions: txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(30)},
	})
	if err != nil {
		return protocol.SimulateTransactionResponse{}, err
	}

	txXDR, err := tx.Base64()
	if err != nil {
		return protocol.SimulateTransactionResponse{}, fmt.Errorf("encoding transaction for simulation: %w", err)
	}

	sim, err := c.rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: txXDR})
	if err != nil {
		return protocol.SimulateTransactionResponse{}, err
	}
	if sim.Error != "" {
		return protocol.SimulateTransactionResponse{}, fmt.Errorf("simulation error: %s", sim.Error)
	}
	return sim, nil
}

func (c *Client) simulateReadOnly(ctx context.Context, functionName string, args xdr.ScVec) (interface{}, error) {
	op := &txnbuild.InvokeHostFunction{
		HostFunction:  buildInvokeContractHostFunction(c.registryContract, functionName, args),
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

	sendResp, err := c.rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: txXDR})
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

	result, err := c.rpc.PollTransaction(ctx, sendResp.Hash)
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
// value, covering the primitive types this daemon actually reads results
// for (currently just the bool from has_watcher_voted, plus the other
// simple scalars for robustness against future read calls).
func decodeScVal(base64XDR string) (interface{}, error) {
	var scv xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(base64XDR, &scv); err != nil {
		return nil, fmt.Errorf("decoding ScVal XDR: %w", err)
	}

	switch scv.Type {
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
