module github.com/SLASettleHQ/slasettle-hub/watcher

// go-stellar-sdk v0.7.3 declares go 1.25 in its own go.mod, so 1.25 is the
// minimum here. The toolchain line makes a local go command use the patched
// 1.25.14 release (downloading it if needed) instead of an older 1.25.x with
// known standard library vulnerabilities; CI's setup-go already resolves the
// latest 1.25.x. See the README for the current test status.
go 1.25

toolchain go1.25.14

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
