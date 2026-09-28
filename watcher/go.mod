module github.com/SLASettleHQ/slasettle-hub/watcher

// go-stellar-sdk v0.7.2 itself requires go >= 1.25, confirmed directly from
// its own go.mod error, not assumed. An environment with only Go 1.22
// available previously could not build this module and had no reachable
// path to a newer toolchain. That is no longer the case: Go 1.25.1 is
// available directly (no toolchain auto-download needed), and go build,
// go vet, and go test all succeed for this module, including
// internal/contract. See README for the current, real test status.
go 1.25

require github.com/stellar/go-stellar-sdk v0.7.3

require (
	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
	github.com/creachadair/jrpc2 v1.2.0 // indirect
	github.com/creachadair/mds v0.13.4 // indirect
	github.com/klauspost/compress v1.17.6 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/stellar/go-xdr v0.0.0-20260806060815-dc590f17552a // indirect
	golang.org/x/exp v0.0.0-20231006140011-7918f672742d // indirect
	golang.org/x/sync v0.18.0 // indirect
)
