#!/bin/bash
set -e

# Multi-Agent Platform Rollback Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${ENVIRONMENT:-production}
NAMESPACE=""
REVISION=""
DRY_RUN=false
USE_HELM=false

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Rollback Multi-Agent Platform deployment

OPTIONS:
    -e, --environment ENV       Environment to rollback (dev|staging|production) [default: production]
    -n, --namespace NAMESPACE   Kubernetes namespace [auto-detected from environment]
    -r, --revision REVISION     Revision number to rollback to [if not specified, rollback to previous]
    -H, --helm                  Use Helm rollback instead of kubectl
    -d, --dry-run              Perform dry run
    -h, --help                 Show this help message

EXAMPLES:
    # Rollback production to previous revision
    $0 -e production

    # Rollback to specific revision
    $0 -e production -r 5

    # Rollback using Helm
    $0 -e production --helm -r 2

EOF
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--revision)
            REVISION="$2"
            shift 2
            ;;
        -H|--helm)
            USE_HELM=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    exit 1
fi

# Set namespace based on environment if not provided
if [ -z "$NAMESPACE" ]; then
    case $ENVIRONMENT in
        dev)
            NAMESPACE="multi-agent-platform-dev"
            ;;
        staging)
            NAMESPACE="multi-agent-platform-staging"
            ;;
        production)
            NAMESPACE="multi-agent-platform"
            ;;
    esac
fi

print_warn "=== ROLLBACK OPERATION ==="
print_warn "Environment: $ENVIRONMENT"
print_warn "Namespace: $NAMESPACE"
print_warn "Revision: ${REVISION:-previous}"
echo

# Confirmation for production
if [ "$ENVIRONMENT" = "production" ] && [ "$DRY_RUN" = false ]; then
    print_warn "You are about to rollback PRODUCTION environment!"
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
    echo
    if [ "$REPLY" != "yes" ]; then
        print_error "Rollback aborted."
        exit 1
    fi
fi

# Rollback using kubectl
rollback_kubectl() {
    local deployments=(api workers web litellm)

    for deployment in "${deployments[@]}"; do
        print_info "Rolling back deployment: $deployment"

        # Show rollout history
        print_info "Rollout history for $deployment:"
        kubectl rollout history deployment/"$deployment" -n "$NAMESPACE"
        echo

        if [ "$DRY_RUN" = false ]; then
            if [ -n "$REVISION" ]; then
                kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE" --to-revision="$REVISION"
            else
                kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE"
            fi

            if [ $? -eq 0 ]; then
                print_info "Successfully initiated rollback for $deployment"
            else
                print_error "Failed to rollback $deployment"
                exit 1
            fi
        else
            print_info "[DRY RUN] Would rollback $deployment"
        fi
    done

    if [ "$DRY_RUN" = false ]; then
        print_info "Waiting for rollback to complete..."
        for deployment in "${deployments[@]}"; do
            kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=300s
        done
    fi
}

# Rollback using Helm
rollback_helm() {
    local release_name="multi-agent-platform-$ENVIRONMENT"

    print_info "Helm release history:"
    helm history "$release_name" -n "$NAMESPACE"
    echo

    if [ "$DRY_RUN" = false ]; then
        if [ -n "$REVISION" ]; then
            helm rollback "$release_name" "$REVISION" -n "$NAMESPACE"
        else
            helm rollback "$release_name" -n "$NAMESPACE"
        fi

        if [ $? -eq 0 ]; then
            print_info "Successfully rolled back Helm release"
        else
            print_error "Failed to rollback Helm release"
            exit 1
        fi
    else
        print_info "[DRY RUN] Would rollback Helm release"
    fi
}

# Main rollback logic
print_info "Starting rollback..."
echo

if [ "$USE_HELM" = true ]; then
    rollback_helm
else
    rollback_kubectl
fi

# Verification
if [ "$DRY_RUN" = false ]; then
    echo
    print_info "Verifying rollback..."

    echo
    print_info "Deployment status:"
    kubectl get deployments -n "$NAMESPACE"

    echo
    print_info "Pod status:"
    kubectl get pods -n "$NAMESPACE"

    echo
    print_info "Rollback completed successfully!"
fi
