package contract

// Tests for the package's ScVal-encoding helpers and other pure functions —
// no network, no RPC mock. These verify the actual data crossing the
// contract boundary by decoding what was encoded with the real xdr package,
// not by comparing against an opaque mock.

import (
	"testing"

	"github.com/SLASettleHQ/slasettle-hub/watcher/internal/endpoint"
	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/strkey"
	"github.com/stellar/go-stellar-sdk/xdr"
)

func TestMustU64EncodesExactValue(t *testing.T) {
	sv := mustU64(42)
	if sv.Type != xdr.ScValTypeScvU64 {
		t.Fatalf("type = %s, want ScvU64", sv.Type)
	}
	if sv.U64 == nil || uint64(*sv.U64) != 42 {
		t.Fatalf("value = %v, want 42", sv.U64)
	}
}

func TestMustU64ZeroAndMax(t *testing.T) {
	for _, v := range []uint64{0, 1, ^uint64(0)} {
		sv := mustU64(v)
		if sv.U64 == nil || uint64(*sv.U64) != v {
			t.Fatalf("mustU64(%d) round-trip = %v", v, sv.U64)
		}
	}
}

func TestMustBytesN32EncodesExactBytesNoTruncationOrPadding(t *testing.T) {
	var b [32]byte
	for i := range b {
		b[i] = byte(i + 1)
	}
	sv := mustBytesN32(b)
	if sv.Type != xdr.ScValTypeScvBytes {
		t.Fatalf("type = %s, want ScvBytes", sv.Type)
	}
	if sv.Bytes == nil {
		t.Fatal("Bytes is nil")
	}
	got := []byte(*sv.Bytes)
	if len(got) != 32 {
		t.Fatalf("len = %d, want 32", len(got))
	}
	for i, want := range b {
		if got[i] != want {
			t.Fatalf("byte %d = %d, want %d", i, got[i], want)
		}
	}
}

// The full v0.2 endpoint commitment algorithm (ASCII trim + domain prefix +
// sha256) is tested in internal/endpoint; this only checks that
// contract.EndpointHash actually delegates to it rather than, say, a plain
// sha256 of the raw URL.
func TestEndpointHashDelegatesToEndpointPackage(t *testing.T) {
	url := "https://example.com/health"
	got, err := EndpointHash(url)
	if err != nil {
		t.Fatalf("EndpointHash(%q) returned error: %v", url, err)
	}
	want, err := endpoint.ComputeEndpointHash(url)
	if err != nil {
		t.Fatalf("endpoint.ComputeEndpointHash(%q) returned error: %v", url, err)
	}
	if got != want {
		t.Fatalf("EndpointHash(%q) = %x, want %x", url, got, want)
	}
}

func TestMustAccountAddressRoundTripsGAddress(t *testing.T) {
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random: %v", err)
	}
	sv := mustAccountAddress(kp.Address())

	if sv.Type != xdr.ScValTypeScvAddress {
		t.Fatalf("type = %s, want ScvAddress", sv.Type)
	}
	if sv.Address == nil {
		t.Fatal("Address is nil")
	}
	if sv.Address.Type != xdr.ScAddressTypeScAddressTypeAccount {
		t.Fatalf("address type = %s, want Account", sv.Address.Type)
	}
	got, err := sv.Address.String()
	if err != nil {
		t.Fatalf("ScAddress.String: %v", err)
	}
	if got != kp.Address() {
		t.Fatalf("round-tripped address = %s, want %s", got, kp.Address())
	}
}

func TestMustAccountAddressPanicsOnInvalidAddress(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic on invalid account address, got none")
		}
	}()
	mustAccountAddress("not-a-real-address")
}

func TestMustContractScAddressRoundTripsCAddress(t *testing.T) {
	var raw [32]byte
	for i := range raw {
		raw[i] = byte(255 - i)
	}
	contractID, err := strkey.Encode(strkey.VersionByteContract, raw[:])
	if err != nil {
		t.Fatalf("strkey.Encode: %v", err)
	}

	addr := mustContractScAddress(contractID)
	if addr.Type != xdr.ScAddressTypeScAddressTypeContract {
		t.Fatalf("address type = %s, want Contract", addr.Type)
	}
	if addr.ContractId == nil {
		t.Fatal("ContractId is nil")
	}
	got, err := addr.String()
	if err != nil {
		t.Fatalf("ScAddress.String: %v", err)
	}
	if got != contractID {
		t.Fatalf("round-tripped contract address = %s, want %s", got, contractID)
	}
}

func TestMustContractScAddressPanicsOnInvalidContractID(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic on invalid contract id, got none")
		}
	}()
	mustContractScAddress("not-a-real-contract-id")
}

// TestMustCheckStatusEnumMatchesContracttypeUnitEnumEncoding locks in the one
// encoding decision the package's own comments flag as "most worth
// double-checking": a #[contracttype] enum with no associated data (like
// CheckStatus::Up / CheckStatus::Down in watcher_registry's storage.rs)
// derives to XDR as ScvVec containing exactly one element, an ScvSymbol
// holding the variant's name — never a bare symbol, never a map.
func TestMustCheckStatusEnumMatchesContracttypeUnitEnumEncoding(t *testing.T) {
	cases := []struct {
		status CheckStatus
		symbol string
	}{
		{StatusUp, "Up"},
		{StatusDown, "Down"},
	}
	for _, c := range cases {
		sv := mustCheckStatusEnum(c.status)
		if sv.Type != xdr.ScValTypeScvVec {
			t.Fatalf("%s: type = %s, want ScvVec", c.status, sv.Type)
		}
		if sv.Vec == nil {
			t.Fatalf("%s: Vec is nil", c.status)
		}
		vec := **sv.Vec
		if len(vec) != 1 {
			t.Fatalf("%s: vec has %d elements, want exactly 1", c.status, len(vec))
		}
		elem := vec[0]
		if elem.Type != xdr.ScValTypeScvSymbol {
			t.Fatalf("%s: vec[0] type = %s, want ScvSymbol", c.status, elem.Type)
		}
		if elem.Sym == nil || string(*elem.Sym) != c.symbol {
			t.Fatalf("%s: vec[0] symbol = %v, want %q", c.status, elem.Sym, c.symbol)
		}
	}
}

func TestMustCheckStatusEnumUpAndDownAreDistinct(t *testing.T) {
	up, err := xdr.MarshalBase64(mustCheckStatusEnum(StatusUp))
	if err != nil {
		t.Fatalf("marshal Up: %v", err)
	}
	down, err := xdr.MarshalBase64(mustCheckStatusEnum(StatusDown))
	if err != nil {
		t.Fatalf("marshal Down: %v", err)
	}
	if up == down {
		t.Fatalf("Up and Down encoded identically: %s", up)
	}
}

func TestBuildInvokeContractHostFunctionPreservesContractFunctionAndArgOrder(t *testing.T) {
	var raw [32]byte
	raw[0] = 9
	contractID, err := strkey.Encode(strkey.VersionByteContract, raw[:])
	if err != nil {
		t.Fatalf("strkey.Encode: %v", err)
	}

	args := xdr.ScVec{mustU64(1), mustU64(2), mustU64(3)}
	hf := buildInvokeContractHostFunction(contractID, "submit_check", args)

	if hf.Type != xdr.HostFunctionTypeHostFunctionTypeInvokeContract {
		t.Fatalf("host function type = %s, want InvokeContract", hf.Type)
	}
	ic := hf.InvokeContract
	if ic == nil {
		t.Fatal("InvokeContract is nil")
	}
	if string(ic.FunctionName) != "submit_check" {
		t.Fatalf("function name = %s, want submit_check", ic.FunctionName)
	}
	gotAddr, err := ic.ContractAddress.String()
	if err != nil {
		t.Fatalf("ContractAddress.String: %v", err)
	}
	if gotAddr != contractID {
		t.Fatalf("contract address = %s, want %s", gotAddr, contractID)
	}
	if len(ic.Args) != 3 {
		t.Fatalf("arg count = %d, want 3", len(ic.Args))
	}
	for i, want := range []uint64{1, 2, 3} {
		if ic.Args[i].U64 == nil || uint64(*ic.Args[i].U64) != want {
			t.Fatalf("arg %d = %v, want %d (argument order not preserved)", i, ic.Args[i].U64, want)
		}
	}
}

func scValBase64(t *testing.T, sv xdr.ScVal) string {
	t.Helper()
	s, err := xdr.MarshalBase64(sv)
	if err != nil {
		t.Fatalf("MarshalBase64: %v", err)
	}
	return s
}

func TestDecodeScValPrimitives(t *testing.T) {
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random: %v", err)
	}

	t.Run("void", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvVoid, nil)
		if err != nil {
			t.Fatalf("NewScVal void: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if got != nil {
			t.Fatalf("got %v, want nil", got)
		}
	})

	t.Run("bool true", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvBool, true)
		if err != nil {
			t.Fatalf("NewScVal bool: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if b, ok := got.(bool); !ok || !b {
			t.Fatalf("got %#v, want true", got)
		}
	})

	t.Run("bool false", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvBool, false)
		if err != nil {
			t.Fatalf("NewScVal bool: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if b, ok := got.(bool); !ok || b {
			t.Fatalf("got %#v, want false", got)
		}
	})

	t.Run("u32", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvU32, xdr.Uint32(7))
		if err != nil {
			t.Fatalf("NewScVal u32: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if v, ok := got.(uint32); !ok || v != 7 {
			t.Fatalf("got %#v, want uint32(7)", got)
		}
	})

	t.Run("i32", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvI32, xdr.Int32(-7))
		if err != nil {
			t.Fatalf("NewScVal i32: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if v, ok := got.(int32); !ok || v != -7 {
			t.Fatalf("got %#v, want int32(-7)", got)
		}
	})

	t.Run("u64", func(t *testing.T) {
		sv := mustU64(9999999999)
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if v, ok := got.(uint64); !ok || v != 9999999999 {
			t.Fatalf("got %#v, want uint64(9999999999)", got)
		}
	})

	t.Run("i64", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvI64, xdr.Int64(-42))
		if err != nil {
			t.Fatalf("NewScVal i64: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if v, ok := got.(int64); !ok || v != -42 {
			t.Fatalf("got %#v, want int64(-42)", got)
		}
	})

	t.Run("symbol", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvSymbol, xdr.ScSymbol("Up"))
		if err != nil {
			t.Fatalf("NewScVal symbol: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if v, ok := got.(string); !ok || v != "Up" {
			t.Fatalf("got %#v, want \"Up\"", got)
		}
	})

	t.Run("string", func(t *testing.T) {
		sv, err := xdr.NewScVal(xdr.ScValTypeScvString, xdr.ScString("hello"))
		if err != nil {
			t.Fatalf("NewScVal string: %v", err)
		}
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if v, ok := got.(string); !ok || v != "hello" {
			t.Fatalf("got %#v, want \"hello\"", got)
		}
	})

	t.Run("address", func(t *testing.T) {
		sv := mustAccountAddress(kp.Address())
		got, err := decodeScVal(scValBase64(t, sv))
		if err != nil {
			t.Fatalf("decodeScVal: %v", err)
		}
		if v, ok := got.(string); !ok || v != kp.Address() {
			t.Fatalf("got %#v, want %q", got, kp.Address())
		}
	})
}

func TestDecodeScValUnhandledTypeReturnsError(t *testing.T) {
	// ScvVec is a real, valid ScVal type this daemon has no general reader
	// for (CheckStatus's specific vec[symbol] shape is decoded separately,
	// not through this generic path). decodeScVal must report an unhandled
	// type plainly rather than silently returning a zero value that could
	// be mistaken for real contract state.
	empty := xdr.ScVec{}
	sv, err := xdr.NewScVal(xdr.ScValTypeScvVec, &empty)
	if err != nil {
		t.Fatalf("NewScVal vec: %v", err)
	}
	_, err = decodeScVal(scValBase64(t, sv))
	if err == nil {
		t.Fatal("expected an error for an unhandled ScVal type, got nil")
	}
}

func TestDecodeScValMapDecodesStructFields(t *testing.T) {
	hashBytes := xdr.ScBytes(make([]byte, 32))
	for i := range hashBytes {
		hashBytes[i] = byte(i)
	}
	entries := xdr.ScMap{
		{Key: mustSymbolScVal(t, "endpoint_hash"), Val: mustScVal(t, xdr.ScValTypeScvBytes, hashBytes)},
		{Key: mustSymbolScVal(t, "bond_amount"), Val: mustU64(42)},
	}
	sv, err := xdr.NewScVal(xdr.ScValTypeScvMap, &entries)
	if err != nil {
		t.Fatalf("NewScVal map: %v", err)
	}

	got, err := decodeScVal(scValBase64(t, sv))
	if err != nil {
		t.Fatalf("decodeScVal: %v", err)
	}
	record, ok := got.(map[string]interface{})
	if !ok {
		t.Fatalf("got %#v, want map[string]interface{}", got)
	}
	hashVal, ok := record["endpoint_hash"].([]byte)
	if !ok || len(hashVal) != 32 {
		t.Fatalf("endpoint_hash = %#v, want 32 bytes", record["endpoint_hash"])
	}
	if record["bond_amount"] != uint64(42) {
		t.Fatalf("bond_amount = %#v, want uint64(42)", record["bond_amount"])
	}
}

func mustSymbolScVal(t *testing.T, s string) xdr.ScVal {
	t.Helper()
	sv, err := xdr.NewScVal(xdr.ScValTypeScvSymbol, xdr.ScSymbol(s))
	if err != nil {
		t.Fatalf("NewScVal symbol %q: %v", s, err)
	}
	return sv
}

func mustScVal(t *testing.T, typ xdr.ScValType, v interface{}) xdr.ScVal {
	t.Helper()
	sv, err := xdr.NewScVal(typ, v)
	if err != nil {
		t.Fatalf("NewScVal: %v", err)
	}
	return sv
}

func TestDecodeScValMalformedXDRReturnsError(t *testing.T) {
	_, err := decodeScVal("this is not valid base64 XDR")
	if err == nil {
		t.Fatal("expected an error for malformed XDR, got nil")
	}
}
