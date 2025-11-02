# ---------- Build stage ----------
FROM golang:1.25-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Static-ish binary (no cgo), smaller
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o redirector .

# ---------- Runtime stage ----------
FROM alpine:latest

# TLS roots for outbound HTTPS (e.g., ACME)
RUN apk --no-cache add ca-certificates

# Non-root app user
RUN addgroup -S redirector && adduser -S redirector -G redirector

WORKDIR /app
COPY --from=builder /app/redirector /app/redirector
RUN mkdir -p /certs && chown -R redirector:redirector /app /certs

USER redirector

EXPOSE 5499 5498

CMD ["/app/redirector"]
