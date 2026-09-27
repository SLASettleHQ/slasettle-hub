module github.com/SLASettleHQ/slasettle-hub/watcher

// go-stellar-sdk v0.7.2 itself requires go >= 1.25 — confirmed directly from
// its own go.mod error, not assumed. This sandbox only has Go 1.22
// available (via apt; the real Go 1.25 toolchain and even Go's own
// toolchain auto-download are both unreachable under this environment's
// network policy — see README). Do not lower this to make local tooling
// happy; lower it in a real environment that actually has 1.25+ instead.
go 1.25

require github.com/stellar/go-stellar-sdk v0.7.2

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
