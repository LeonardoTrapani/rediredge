# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o redirector .

# Runtime stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/redirector .

# Create cert cache directory
RUN mkdir -p /certs && chmod 700 /certs

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Run as non-root user
RUN addgroup -S redirector && adduser -S redirector -G redirector
RUN chown -R redirector:redirector /root /certs
USER redirector

# Set default environment variables
ENV REDIS_ADDR=localhost:5498 \
    REDIS_PASSWORD="" \
    CERT_CACHE_DIR=/certs \
    HTTP_ADDR=:80 \
    HTTPS_ADDR=:443

CMD ["./redirector"]
