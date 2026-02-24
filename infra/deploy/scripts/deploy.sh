#!/bin/bash
set -e

# Multi-Agent Platform Deployment Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")/k8s"
HELM_DIR="$(dirname "$SCRIPT_DIR")/helm/multi-agent-platform"

# Default values
ENVIRONMENT=${ENVIRONMENT:-production}
NAMESPACE=""
DRY_RUN=false
SKIP_PREFLIGHT=false
USE_HELM=false
CLOUD_PROVIDER=""

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

Deploy Multi-Agent Platform to Kubernetes

OPTIONS:
    -e, --environment ENV       Environment to deploy (dev|staging|production) [default: production]
    -n, --namespace NAMESPACE   Kubernetes namespace [auto-detected from environment]
    -c, --cloud PROVIDER        Cloud provider (aws|gcp|azure) [optional]
    -H, --helm                  Use Helm instead of Kustomize
    -d, --dry-run              Perform dry run without applying changes
    -s, --skip-preflight       Skip pre-flight checks
    -h, --help                 Show this help message

EXAMPLES:
    # Deploy to production using Kustomize
    $0 -e production

    # Deploy to dev on AWS EKS using Kustomize
    $0 -e dev -c aws

    # Deploy to production using Helm
    $0 -e production --helm

    # Dry run for staging
    $0 -e staging --dry-run

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
        -c|--cloud)
            CLOUD_PROVIDER="$2"
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
        -s|--skip-preflight)
            SKIP_PREFLIGHT=true
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
    print_error "Must be one of: dev, staging, production"
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

print_info "Deployment Configuration:"
print_info "  Environment: $ENVIRONMENT"
print_info "  Namespace: $NAMESPACE"
print_info "  Cloud Provider: ${CLOUD_PROVIDER:-none}"
print_info "  Use Helm: $USE_HELM"
print_info "  Dry Run: $DRY_RUN"
echo

# Pre-flight checks
if [ "$SKIP_PREFLIGHT" = false ]; then
    print_info "Running pre-flight checks..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi

    # Check if using Helm
    if [ "$USE_HELM" = true ]; then
        if ! command -v helm &> /dev/null; then
            print_error "helm not found. Please install helm."
            exit 1
        fi
    else
        # Check kustomize
        if ! command -v kustomize &> /dev/null; then
            print_error "kustomize not found. Please install kustomize."
            exit 1
        fi
    fi

    # Verify secrets exist
    print_info "Verifying secrets configuration..."
    print_warn "Please ensure all secrets are properly configured before deployment."
    print_warn "Required secrets: DB_PASSWORD, REDIS_PASSWORD, API keys, etc."

    read -p "Have you configured all required secrets? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment aborted. Please configure secrets first."
        exit 1
    fi

    print_info "Pre-flight checks passed."
    echo
fi

# Deploy using Kustomize
deploy_kustomize() {
    local overlay_dir="$K8S_DIR/overlays/$ENVIRONMENT"
    local kustomize_file="$overlay_dir/kustomization.yaml"

    # Use cloud-specific overlay if specified
    if [ -n "$CLOUD_PROVIDER" ]; then
        if [ "$ENVIRONMENT" = "production" ]; then
            kustomize_file="$overlay_dir/${CLOUD_PROVIDER}.yaml"
            if [ ! -f "$kustomize_file" ]; then
                print_error "Cloud provider overlay not found: $kustomize_file"
                exit 1
            fi
            print_info "Using cloud-specific overlay for $CLOUD_PROVIDER"
        else
            print_warn "Cloud-specific overlays only available for production environment"
        fi
    fi

    print_info "Building manifests with Kustomize..."

    if [ "$DRY_RUN" = true ]; then
        print_info "Dry run - showing manifests:"
        kustomize build "$(dirname "$kustomize_file")"
    else
        print_info "Applying manifests..."
        kustomize build "$(dirname "$kustomize_file")" | kubectl apply -f -

        if [ $? -eq 0 ]; then
            print_info "Deployment successful!"
        else
            print_error "Deployment failed!"
            exit 1
        fi
    fi
}

# Deploy using Helm
deploy_helm() {
    local release_name="multi-agent-platform-$ENVIRONMENT"
    local values_file="$HELM_DIR/values.yaml"

    # Create environment-specific values file if it exists
    local env_values_file="$HELM_DIR/values-$ENVIRONMENT.yaml"

    print_info "Deploying with Helm..."

    local helm_args=(
        upgrade
        --install
        "$release_name"
        "$HELM_DIR"
        --namespace "$NAMESPACE"
        --create-namespace
        --values "$values_file"
        --set "global.environment=$ENVIRONMENT"
    )

    if [ -f "$env_values_file" ]; then
        helm_args+=(--values "$env_values_file")
    fi

    if [ -n "$CLOUD_PROVIDER" ]; then
        helm_args+=(--set "cloudProvider.name=$CLOUD_PROVIDER")
    fi

    if [ "$DRY_RUN" = true ]; then
        helm_args+=(--dry-run --debug)
    fi

    helm "${helm_args[@]}"

    if [ $? -eq 0 ] && [ "$DRY_RUN" = false ]; then
        print_info "Helm deployment successful!"
    elif [ "$DRY_RUN" = false ]; then
        print_error "Helm deployment failed!"
        exit 1
    fi
}

# Main deployment logic
print_info "Starting deployment..."
echo

if [ "$USE_HELM" = true ]; then
    deploy_helm
else
    deploy_kustomize
fi

# Post-deployment verification
if [ "$DRY_RUN" = false ]; then
    echo
    print_info "Verifying deployment..."

    # Wait for deployments to be ready
    print_info "Waiting for deployments to be ready (timeout: 5 minutes)..."
    kubectl wait --for=condition=available --timeout=300s \
        deployment --all -n "$NAMESPACE" || true

    # Show deployment status
    echo
    print_info "Deployment status:"
    kubectl get deployments -n "$NAMESPACE"

    echo
    print_info "Pod status:"
    kubectl get pods -n "$NAMESPACE"

    echo
    print_info "Service status:"
    kubectl get services -n "$NAMESPACE"

    echo
    print_info "Ingress status:"
    kubectl get ingress -n "$NAMESPACE"

    echo
    print_info "Deployment completed successfully!"
    print_info "Application should be available at:"

    if [ "$ENVIRONMENT" = "production" ]; then
        print_info "  - Web: https://multi-agent-platform.example.com"
        print_info "  - API: https://api.multi-agent-platform.example.com"
    else
        print_info "  - Web: https://$ENVIRONMENT.multi-agent-platform.example.com"
        print_info "  - API: https://$ENVIRONMENT-api.multi-agent-platform.example.com"
    fi

    echo
    print_warn "Note: It may take a few minutes for TLS certificates to be issued."
fi
