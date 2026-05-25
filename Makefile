.PHONY: dev build run test clean frontend-build

dev:
	@PLANBOARD_DEV=1 go run ./cmd/planboard &
	@cd frontend && npm run dev

build: frontend-build
	@go build -o bin/planboard ./cmd/planboard

frontend-build:
	@cd frontend && npm run build

run:
	@go run ./cmd/planboard

test:
	@go test ./... -v

clean:
	@rm -rf bin/ frontend/dist/
