package health

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCheckReportsUpFor200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewChecker(2*time.Second, 400)
	res := c.Check(context.Background(), srv.URL)

	if res.Status != Up {
		t.Errorf("expected Up, got %v (err: %v)", res.Status, res.Err)
	}
	if res.StatusCode != 200 {
		t.Errorf("expected status code 200, got %d", res.StatusCode)
	}
}

func TestCheckReportsDownFor500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := NewChecker(2*time.Second, 400)
	res := c.Check(context.Background(), srv.URL)

	if res.Status != Down {
		t.Errorf("expected Down for a 500 response, got %v", res.Status)
	}
	if res.StatusCode != 500 {
		t.Errorf("expected status code 500, got %d", res.StatusCode)
	}
}

func TestCheckReportsUpFor3xxByDefault(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusMovedPermanently)
	}))
	defer srv.Close()

	c := NewChecker(2*time.Second, 400)
	res := c.Check(context.Background(), srv.URL)

	if res.Status != Up {
		t.Errorf("expected a 3xx to count as Up with the default threshold, got %v", res.Status)
	}
}

func TestCheckRespectsACustomExpectMaxStatusCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusMovedPermanently) // 301
	}))
	defer srv.Close()

	// A stricter threshold: only 2xx counts as up.
	c := NewChecker(2*time.Second, 300)
	res := c.Check(context.Background(), srv.URL)

	if res.Status != Down {
		t.Errorf("expected Down with a strict 300 threshold on a 301 response, got %v", res.Status)
	}
}

func TestCheckReportsDownAndTimeoutOnSlowServer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewChecker(20*time.Millisecond, 400) // much shorter than the server's delay
	res := c.Check(context.Background(), srv.URL)

	if res.Status != Down {
		t.Errorf("expected Down on timeout, got %v", res.Status)
	}
	if !res.Timeout {
		t.Errorf("expected Timeout to be true for a request that exceeded the client timeout")
	}
}

func TestCheckReportsDownForUnreachableHost(t *testing.T) {
	c := NewChecker(500*time.Millisecond, 400)
	// Port 1 is reserved and essentially guaranteed to refuse the
	// connection immediately rather than hang, keeping this test fast.
	res := c.Check(context.Background(), "http://127.0.0.1:1")

	if res.Status != Down {
		t.Errorf("expected Down for an unreachable host, got %v", res.Status)
	}
	if res.Err == nil {
		t.Errorf("expected a non-nil error for an unreachable host")
	}
}

func TestCheckReportsDownForMalformedURL(t *testing.T) {
	c := NewChecker(time.Second, 400)
	res := c.Check(context.Background(), "://not-a-valid-url")

	if res.Status != Down {
		t.Errorf("expected Down for a malformed URL, got %v", res.Status)
	}
}
