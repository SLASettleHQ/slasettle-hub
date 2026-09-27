// Package health performs the actual uptime check this watcher exists to
// do: one HTTP request against a target URL, classified up or down. No
// external dependencies — net/http/httptest can exercise this fully and
// realistically without a real network call.
package health

import (
	"context"
	"net/http"
	"time"
)

type Status string

const (
	Up   Status = "up"
	Down Status = "down"
)

type Result struct {
	Status     Status
	StatusCode int  // 0 if the request never got a response at all
	Timeout    bool // true if the failure was specifically a timeout
	Err        error
}

type Checker struct {
	client        *http.Client
	expectMaxCode int
}

func NewChecker(timeout time.Duration, expectMaxStatusCode int) *Checker {
	return &Checker{
		client:        &http.Client{Timeout: timeout},
		expectMaxCode: expectMaxStatusCode,
	}
}

// Check performs one GET request against targetURL. Any failure to get a
// response at all — connection refused, DNS failure, timeout — counts as
// Down, same as an explicit 5xx would. A response is Up if its status code
// is below expectMaxStatusCode (see config.HTTPExpectMaxStatus's doc
// comment for the default and why).
func (c *Checker) Check(ctx context.Context, targetURL string) Result {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return Result{Status: Down, Err: err}
	}

	resp, err := c.client.Do(req)
	if err != nil {
		timeout := false
		if ctxErr := ctx.Err(); ctxErr != nil {
			timeout = true
		} else if netErr, ok := err.(interface{ Timeout() bool }); ok {
			timeout = netErr.Timeout()
		}
		return Result{Status: Down, Timeout: timeout, Err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode < c.expectMaxCode {
		return Result{Status: Up, StatusCode: resp.StatusCode}
	}
	return Result{Status: Down, StatusCode: resp.StatusCode}
}
