#!/bin/bash
set -e

# Multi-Agent Platform Scaling Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${ENVIRONMENT:-production}
NAMESPACE=""
COMPONENT=""
REPLICAS=""
DRY_RUN=false

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

Scale Multi-Agent Platform components

OPTIONS:
    -e, --environment ENV       Environment (dev|staging|production) [default: production]
    -n, --namespace NAMESPACE   Kubernetes namespace [auto-detected from environment]
    -c, --component COMPONENT   Component to scale (api|workers|web|litellm|all)
    -r, --replicas COUNT        Number of replicas
    -d, --dry-run              Perform dry run
    -h, --help                 Show this help message

EXAMPLES:
    # Scale API to 5 replicas
    $0 -e production -c api -r 5

    # Scale all components to 3 replicas
    $0 -e production -c all -r 3

    # Scale workers to 10 replicas in staging
    $0 -e staging -c workers -r 10

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
        -c|--component)
            COMPONENT="$2"
            shift 2
            ;;
        -r|--replicas)
            REPLICAS="$2"
            shift 2
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

# Validate inputs
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    exit 1
fi

if [ -z "$COMPONENT" ]; then
    print_error "Component is required"
    usage
fi

if [ -z "$REPLICAS" ]; then
    print_error "Replica count is required"
    usage
fi

if ! [[ "$REPLICAS" =~ ^[0-9]+$ ]]; then
    print_error "Replicas must be a number"
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

print_info "Scaling Configuration:"
print_info "  Environment: $ENVIRONMENT"
print_info "  Namespace: $NAMESPACE"
print_info "  Component: $COMPONENT"
print_info "  Replicas: $REPLICAS"
print_info "  Dry Run: $DRY_RUN"
echo

# Scale a single component
scale_component() {
    local component=$1
    local replicas=$2

    print_info "Scaling $component to $replicas replicas..."

    if [ "$DRY_RUN" = false ]; then
        kubectl scale deployment/"$component" --replicas="$replicas" -n "$NAMESPACE"

        if [ $? -eq 0 ]; then
            print_info "Successfully scaled $component"

            # Wait for rollout
            print_info "Waiting for rollout to complete..."
            kubectl rollout status deployment/"$component" -n "$NAMESPACE" --timeout=300s
        else
            print_error "Failed to scale $component"
            exit 1
        fi
    else
        print_info "[DRY RUN] Would scale $component to $replicas replicas"
    fi
}

# Main scaling logic
if [ "$COMPONENT" = "all" ]; then
    components=(api workers web litellm)
    for comp in "${components[@]}"; do
        scale_component "$comp" "$REPLICAS"
    done
else
    if [[ ! "$COMPONENT" =~ ^(api|workers|web|litellm)$ ]]; then
        print_error "Invalid component: $COMPONENT"
        print_error "Must be one of: api, workers, web, litellm, all"
        exit 1
    fi
    scale_component "$COMPONENT" "$REPLICAS"
fi

# Show final status
if [ "$DRY_RUN" = false ]; then
    echo
    print_info "Current deployment status:"
    kubectl get deployments -n "$NAMESPACE"

    echo
    print_info "Current HPA status:"
    kubectl get hpa -n "$NAMESPACE"

    echo
    print_warn "Note: If HPA is enabled, it may override manual scaling."
fi

print_info "Scaling operation completed!"
