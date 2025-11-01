package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/acme/autocert"
)

type Config struct {
	RedisAddr     string
	RedisPassword string
	CertCacheDir  string
	HTTPAddr      string
	HTTPSAddr     string
}

func loadConfig() Config {
	getEnv := func(key, defaultVal string) string {
		if val := os.Getenv(key); val != "" {
			return val
		}
		return defaultVal
	}

	return Config{
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:5498"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		CertCacheDir:  getEnv("CERT_CACHE_DIR", "./certs"),
		HTTPAddr:      getEnv("HTTP_ADDR", ":80"),
		HTTPSAddr:     getEnv("HTTPS_ADDR", ":443"),
	}
}

func getDomainAndSubdomain(host string) (string, string) {
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
			status:         200,
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

	domain, subdomain := getDomainAndSubdomain(r.Host)
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

func buildHostPolicy(rdb *redis.Client) func(ctx context.Context, host string) error {
	return func(ctx context.Context, host string) error {
		// Remove port if present
		hostWithoutPort := strings.Split(host, ":")[0]
		domain, subdomain := getDomainAndSubdomain(hostWithoutPort)

		field := domain
		if subdomain != "" {
			field = domain + ":" + subdomain
		}

		exists, err := rdb.HExists(ctx, "redirects", field).Result()
		if err != nil {
			return fmt.Errorf("redis error checking domain %s: %w", host, err)
		}
		if !exists {
			return fmt.Errorf("domain not configured: %s", host)
		}
		return nil
	}
}

func main() {
	config := loadConfig()

	rdb := redis.NewClient(&redis.Options{
		Addr:     config.RedisAddr,
		Password: config.RedisPassword,
	})

	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}
	log.Printf("Connected to Redis at %s", config.RedisAddr)

	if err := os.MkdirAll(config.CertCacheDir, 0o700); err != nil {
		log.Fatal("Failed to create cert cache dir:", err)
	}
	log.Printf("Using cert cache dir: %s", config.CertCacheDir)

	certManager := &autocert.Manager{
		Cache:      autocert.DirCache(config.CertCacheDir),
		Prompt:     autocert.AcceptTOS,
		HostPolicy: buildHostPolicy(rdb),
	}

	handler := &RedirectHandler{redis: rdb}

	// HTTP server (port 80) - ACME challenges + HTTP→HTTPS redirect
	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Handle ACME challenges
		if strings.HasPrefix(r.URL.Path, "/.well-known/acme-challenge/") {
			certManager.HTTPHandler(nil).ServeHTTP(w, r)
			return
		}

		// Redirect HTTP to HTTPS
		target := "https://" + r.Host + r.URL.RequestURI()
		http.Redirect(w, r, target, http.StatusPermanentRedirect)
	})

	httpServer := &http.Server{
		Addr:    config.HTTPAddr,
		Handler: httpMux,
	}

	// HTTPS server (port 443) - TLS + redirects
	httpsMux := http.NewServeMux()
	httpsMux.HandleFunc("/", loggingMiddleware(handler.redirect))

	httpsServer := &http.Server{
		Addr:      config.HTTPSAddr,
		Handler:   httpsMux,
		TLSConfig: certManager.TLSConfig(),
	}

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		log.Printf("Starting HTTP server on %s", config.HTTPAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP server error: %v", err)
		}
	}()

	go func() {
		defer wg.Done()
		log.Printf("Starting HTTPS server on %s", config.HTTPSAddr)
		if err := httpsServer.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTPS server error: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down servers...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}
	if err := httpsServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTPS server shutdown error: %v", err)
	}

	wg.Wait()
	log.Println("Servers stopped")
}
