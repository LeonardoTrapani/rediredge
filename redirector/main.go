package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

func getDomainAndSubdomain(req *http.Request) (string, string) {
	host := req.Host
	parts := strings.Split(host, ".")
	domain := ""
	subdomain := ""
	if len(parts) >= 2 {
		domain = parts[len(parts)-2] + "." + parts[len(parts)-1]
		if len(parts) > 2 {
			subdomain = strings.Join(parts[:len(parts)-2], ".")
		}
	}

	return domain, subdomain
}

type responseWriter struct {
	http.ResponseWriter
	status   int
	location string
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Header() http.Header {
	return rw.ResponseWriter.Header()
}

type RedirectRule struct {
	To            string `json:"to"`
	Status        int    `json:"status"`
	PreservePath  bool   `json:"preservePath"`
	PreserveQuery bool   `json:"preserveQuery"`
	Enabled       bool   `json:"enabled"`
}

type RedirectHandler struct {
	redis *redis.Client
}

func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{
			ResponseWriter: w,
			status:         200, // default status
			location:       "",
		}
		log.Printf("Request: %s %s", r.Method, r.Host+r.URL.String())
		next(rw, r)

		location := rw.Header().Get("Location")
		log.Printf("Response: %d -> %s in %v", rw.status, location, time.Since(start))
	}
}

func (h *RedirectHandler) redirect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	domain, subdomain := getDomainAndSubdomain(r)
	search := r.URL.Path
	query := r.URL.RawQuery

	ctx := r.Context()

	field := domain
	if subdomain != "" {
		field = domain + ":" + subdomain
	}
	result := h.redis.HGet(ctx, "redirects", field)
	val, err := result.Result()
	if err != nil || val == "" {
		http.NotFound(w, r)
		return
	}

	var rule RedirectRule
	if err := json.Unmarshal([]byte(val), &rule); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if !rule.Enabled {
		http.NotFound(w, r)
		return
	}

	location := rule.To
	if rule.PreservePath && search != "/" {
		location += search
	}
	if rule.PreserveQuery && query != "" {
		location += "?" + query
	}

	http.Redirect(w, r, location, rule.Status)
}

func main() {
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:5498",
	})

	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}

	handler := &RedirectHandler{redis: rdb}

	http.HandleFunc("/", loggingMiddleware(handler.redirect))

	log.Println("Starting server on :18549")
	http.ListenAndServe(":18549", nil)
}
