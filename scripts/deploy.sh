#!/bin/bash
# ===========================================
# STADIUM DASHBOARD - DEPLOYMENT SCRIPT
# ===========================================
#
# Usage:
#   ./scripts/deploy.sh                  # Deploy latest
#   ./scripts/deploy.sh rollback         # Rollback to previous version
#   ./scripts/deploy.sh status           # Check deployment status
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
ENV_FILE="$PROJECT_DIR/.env.production"
BACKUP_TAG="v2.0.0-pre-deploy"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_requirements() {
    log_info "Checking requirements..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env.production not found. Creating from template..."
        cat > "$ENV_FILE" << 'EOF'
# Database Configuration
DB_SERVER=10.120.0.19
DB_USER=sa
DB_PASSWORD=YOUR_PASSWORD_HERE
DB_DATABASE=anysys

# Ollama LLM
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:72b

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_JWT_SECRET_HERE

# Version
VERSION=2.0.0
EOF
        log_warning "Please edit $ENV_FILE with your credentials before deploying"
        exit 1
    fi

    log_success "Requirements check passed"
}

backup_current() {
    log_info "Creating backup of current deployment..."

    CURRENT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "untagged")
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    # Save current image if exists
    if docker images | grep -q "stadium-dashboard"; then
        docker tag stadium-dashboard:latest stadium-dashboard:backup_$TIMESTAMP 2>/dev/null || true
        log_success "Image backed up as stadium-dashboard:backup_$TIMESTAMP"
    fi

    # Save current git commit
    echo "$(git rev-parse HEAD)" > "$PROJECT_DIR/.last_deployment"
    log_success "Git commit saved to .last_deployment"
}

deploy() {
    log_info "Starting deployment..."

    cd "$PROJECT_DIR"

    # Load environment
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

    # Backup current state
    backup_current

    # Build and deploy
    log_info "Building Docker image..."
    docker compose -f "$COMPOSE_FILE" build --no-cache

    log_info "Stopping current containers..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

    log_info "Starting new containers..."
    docker compose -f "$COMPOSE_FILE" up -d

    # Wait for health check
    log_info "Waiting for health check..."
    sleep 10

    if docker compose -f "$COMPOSE_FILE" ps | grep -q "healthy"; then
        log_success "Deployment successful!"
        show_status
    else
        log_warning "Health check not ready yet. Checking status..."
        show_status
    fi
}

rollback() {
    log_info "Starting rollback..."

    cd "$PROJECT_DIR"

    if [ -f "$PROJECT_DIR/.last_deployment" ]; then
        LAST_COMMIT=$(cat "$PROJECT_DIR/.last_deployment")
        log_info "Rolling back to commit: $LAST_COMMIT"
    else
        log_info "Rolling back to tag: $BACKUP_TAG"
        git checkout "$BACKUP_TAG"
    fi

    # Rebuild and deploy
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" build --no-cache
    docker compose -f "$COMPOSE_FILE" up -d

    log_success "Rollback complete"
    show_status
}

show_status() {
    echo ""
    log_info "=== Deployment Status ==="
    echo ""

    docker compose -f "$COMPOSE_FILE" ps

    echo ""
    log_info "=== Recent Logs ==="
    docker compose -f "$COMPOSE_FILE" logs --tail=20

    echo ""
    log_info "=== Application URLs ==="
    echo "  Dashboard: http://localhost:3000"
    echo "  Login:     http://localhost:3000/login"
    echo "  Health:    http://localhost:3000/api/auth/me"
}

show_logs() {
    docker compose -f "$COMPOSE_FILE" logs -f
}

# Main
case "${1:-deploy}" in
    deploy)
        check_requirements
        deploy
        ;;
    rollback)
        check_requirements
        rollback
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|status|logs}"
        exit 1
        ;;
esac
