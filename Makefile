# MicroCourses Makefile

.PHONY: help install setup dev build test clean docker-up docker-down deploy

help: ## Show this help message
	@echo "MicroCourses - Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	npm install
	cd frontend && npm install

setup: install ## Setup project (install deps, migrate DB, seed data)
	cp .env.example .env || true
	npm run db:migrate
	npm run seed

dev: ## Start development servers
	@echo "Starting backend and frontend servers..."
	@echo "Backend: http://localhost:4000"
	@echo "Frontend: http://localhost:3000"
ifeq ($(OS),Windows_NT)
	@powershell -ExecutionPolicy Bypass -File start.ps1
else
	@./start.sh
endif

build: ## Build for production
	cd frontend && npm run build

test: ## Run all tests
	npm test

test-watch: ## Run tests in watch mode
	npm test -- --watch

lint: ## Run linting
	npm run lint
	cd frontend && npm run lint || true

clean: ## Clean node_modules and build files
	rm -rf node_modules
	rm -rf frontend/node_modules
	rm -rf frontend/build
	rm -rf coverage
	rm -f *.db

docker-up: ## Start with Docker Compose
	docker-compose up -d

docker-down: ## Stop Docker Compose
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-build: ## Build Docker images
	docker-compose build

migrate: ## Run database migrations
	npm run db:migrate

seed: ## Seed database with test data
	npm run seed

deploy-vercel: ## Deploy to Vercel
	cd frontend && npx vercel --prod

deploy-render: ## Instructions for Render deployment
	@echo "To deploy to Render:"
	@echo "1. Connect your GitHub repo to Render"
	@echo "2. Set build command: npm install && npm run build"
	@echo "3. Set start command: npm start"
	@echo "4. Add environment variables from .env.example"

status: ## Check service status
	@echo "Checking service status..."
	@curl -s http://localhost:4000/health || echo "Backend not running"
	@curl -s http://localhost:3000 > /dev/null && echo "Frontend running" || echo "Frontend not running"

backup: ## Backup database
	@echo "Creating database backup..."
	@npm run db:backup || echo "Backup failed - check database connection"

restore: ## Restore database from backup
	@echo "Restoring database from backup..."
	@npm run db:restore || echo "Restore failed - check backup file"