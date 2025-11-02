# ---------- Build stage ----------
FROM golang:1.25-bookworm AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Static binary (no cgo)
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o redirector .

# ---------- Runtime stage ----------
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /app/redirector /app/redirector

WORKDIR /app
EXPOSE 5499 5498

CMD ["/app/redirector"]
