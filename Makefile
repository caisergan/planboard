.PHONY: dev build run test clean frontend-build embed-frontend

dev:
	@PLANBOARD_DEV=1 go run ./cmd/planboard &
	@cd frontend && npm run dev

build: frontend-build embed-frontend
	@go build -o bin/planboard ./cmd/planboard
	@echo "Built: bin/planboard"

frontend-build:
	@cd frontend && npm run build

embed-frontend: frontend-build
	@rm -rf cmd/planboard/static
	@cp -r frontend/dist cmd/planboard/static

run:
	@go run ./cmd/planboard

test:
	@go test ./... -v

clean:
	@rm -rf bin/ frontend/dist/ cmd/planboard/static/
	@mkdir -p cmd/planboard/static
	@echo '<!DOCTYPE html><html><body>Run "make build"</body></html>' > cmd/planboard/static/index.html
