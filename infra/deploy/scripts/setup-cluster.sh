#!/bin/bash
set -e

# Kubernetes Cluster Setup Script
# This script installs required components for the Multi-Agent Platform

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Setup Kubernetes cluster with required components

OPTIONS:
    --ingress-nginx        Install NGINX Ingress Controller
    --cert-manager         Install cert-manager
    --metrics-server       Install Metrics Server
    --prometheus           Install Prometheus Operator
    --external-secrets     Install External Secrets Operator
    --all                  Install all components
    -h, --help            Show this help message

EOF
    exit 1
}

# Default values
INSTALL_INGRESS=false
INSTALL_CERT_MANAGER=false
INSTALL_METRICS=false
INSTALL_PROMETHEUS=false
INSTALL_EXTERNAL_SECRETS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ingress-nginx)
            INSTALL_INGRESS=true
            shift
            ;;
        --cert-manager)
            INSTALL_CERT_MANAGER=true
            shift
            ;;
        --metrics-server)
            INSTALL_METRICS=true
            shift
            ;;
        --prometheus)
            INSTALL_PROMETHEUS=true
            shift
            ;;
        --external-secrets)
            INSTALL_EXTERNAL_SECRETS=true
            shift
            ;;
        --all)
            INSTALL_INGRESS=true
            INSTALL_CERT_MANAGER=true
            INSTALL_METRICS=true
            INSTALL_PROMETHEUS=true
            INSTALL_EXTERNAL_SECRETS=true
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

# Check prerequisites
print_info "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl."
    exit 1
fi

if ! command -v helm &> /dev/null; then
    print_error "helm not found. Please install helm."
    exit 1
fi

print_info "Prerequisites check passed."
echo

# Install NGINX Ingress Controller
if [ "$INSTALL_INGRESS" = true ]; then
    print_info "Installing NGINX Ingress Controller..."

    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update

    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
      --namespace ingress-nginx \
      --create-namespace \
      --set controller.metrics.enabled=true \
      --set controller.podAnnotations."prometheus\.io/scrape"=true \
      --set controller.podAnnotations."prometheus\.io/port"=10254 \
      --wait

    print_info "NGINX Ingress Controller installed successfully."
    echo
fi

# Install cert-manager
if [ "$INSTALL_CERT_MANAGER" = true ]; then
    print_info "Installing cert-manager..."

    helm repo add jetstack https://charts.jetstack.io
    helm repo update

    helm upgrade --install cert-manager jetstack/cert-manager \
      --namespace cert-manager \
      --create-namespace \
      --set installCRDs=true \
      --wait

    print_info "cert-manager installed successfully."
    echo
fi

# Install Metrics Server
if [ "$INSTALL_METRICS" = true ]; then
    print_info "Installing Metrics Server..."

    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

    print_info "Metrics Server installed successfully."
    echo
fi

# Install Prometheus Operator
if [ "$INSTALL_PROMETHEUS" = true ]; then
    print_info "Installing Prometheus Operator..."

    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
      --namespace monitoring \
      --create-namespace \
      --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
      --wait

    print_info "Prometheus Operator installed successfully."
    print_info "Access Grafana: kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80"
    print_info "Default Grafana credentials: admin / prom-operator"
    echo
fi

# Install External Secrets Operator
if [ "$INSTALL_EXTERNAL_SECRETS" = true ]; then
    print_info "Installing External Secrets Operator..."

    helm repo add external-secrets https://charts.external-secrets.io
    helm repo update

    helm upgrade --install external-secrets external-secrets/external-secrets \
      --namespace external-secrets-system \
      --create-namespace \
      --wait

    print_info "External Secrets Operator installed successfully."
    echo
fi

print_info "Cluster setup completed!"
print_info "Installed components:"
[ "$INSTALL_INGRESS" = true ] && echo "  ✓ NGINX Ingress Controller"
[ "$INSTALL_CERT_MANAGER" = true ] && echo "  ✓ cert-manager"
[ "$INSTALL_METRICS" = true ] && echo "  ✓ Metrics Server"
[ "$INSTALL_PROMETHEUS" = true ] && echo "  ✓ Prometheus Operator"
[ "$INSTALL_EXTERNAL_SECRETS" = true ] && echo "  ✓ External Secrets Operator"
