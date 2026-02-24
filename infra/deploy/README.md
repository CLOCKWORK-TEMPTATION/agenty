# Multi-Agent Platform - Kubernetes Deployment

Production-ready Kubernetes deployment configurations for the Multi-Agent Teams Platform.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Deployment Methods](#deployment-methods)
- [Environments](#environments)
- [Cloud Providers](#cloud-providers)
- [Configuration](#configuration)
- [Secrets Management](#secrets-management)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

This directory contains comprehensive Kubernetes manifests and Helm charts for deploying the Multi-Agent Platform to production environments. The deployment supports:

- Multiple environments (dev, staging, production)
- Multiple cloud providers (AWS EKS, GCP GKE, Azure AKS)
- Two deployment methods (Kustomize and Helm)
- High availability and auto-scaling
- Production-grade security and monitoring

## Prerequisites

### Required Tools

- **kubectl** (v1.28+)
- **kustomize** (v5.0+) OR **helm** (v3.12+)
- **Docker** (for building images)
- Access to a Kubernetes cluster (1.28+)

### Optional Tools

- **cert-manager** (for automatic TLS certificates)
- **Prometheus Operator** (for monitoring)
- **External Secrets Operator** (for secrets management)

### Kubernetes Cluster Requirements

- Kubernetes 1.28 or higher
- At least 3 worker nodes (for HA)
- Support for LoadBalancer service type
- Storage provisioner (for persistent volumes)
- Ingress controller (NGINX recommended)

## Architecture

### Components

1. **PostgreSQL** - Primary database with pgvector extension
2. **Redis** - Cache and queue backend
3. **LiteLLM Proxy** - AI model router and proxy
4. **API Service** - REST API backend
5. **Workers** - Background job processors
6. **Web** - Next.js frontend

### Network Flow

```
Internet → Ingress → Web (Next.js) ↔ API ↔ PostgreSQL
                                    ↔ Redis
                                    ↔ LiteLLM → AI Providers
                     Workers ↔ Redis
                            ↔ PostgreSQL
                            ↔ LiteLLM
```

## Quick Start

### 1. Configure Secrets

First, create your secrets file:

```bash
# Copy the template
cp k8s/base/secrets.yaml k8s/base/secrets-local.yaml

# Edit and fill in actual values
vim k8s/base/secrets-local.yaml
```

**Important:** Never commit `secrets-local.yaml` to version control!

### 2. Deploy to Development

```bash
# Using Kustomize
./scripts/deploy.sh -e dev

# Using Helm
./scripts/deploy.sh -e dev --helm
```

### 3. Verify Deployment

```bash
# Check pods
kubectl get pods -n multi-agent-platform-dev

# Check services
kubectl get svc -n multi-agent-platform-dev

# Check ingress
kubectl get ingress -n multi-agent-platform-dev
```

## Deployment Methods

### Method 1: Kustomize (Recommended)

Kustomize provides declarative configuration management with overlays for different environments.

**Deploy to production:**

```bash
./scripts/deploy.sh -e production
```

**Deploy with cloud-specific configuration:**

```bash
# AWS EKS
./scripts/deploy.sh -e production -c aws

# GCP GKE
./scripts/deploy.sh -e production -c gcp

# Azure AKS
./scripts/deploy.sh -e production -c azure
```

**Manual deployment:**

```bash
# Build and preview manifests
kustomize build k8s/overlays/production

# Apply to cluster
kustomize build k8s/overlays/production | kubectl apply -f -
```

### Method 2: Helm

Helm provides package management and easier upgrades.

**Install chart:**

```bash
helm install multi-agent-platform ./helm/multi-agent-platform \
  --namespace multi-agent-platform \
  --create-namespace \
  --values helm/multi-agent-platform/values.yaml
```

**Upgrade:**

```bash
helm upgrade multi-agent-platform ./helm/multi-agent-platform \
  --namespace multi-agent-platform
```

**Rollback:**

```bash
helm rollback multi-agent-platform -n multi-agent-platform
```

## Environments

### Development (`dev`)

- **Namespace:** `multi-agent-platform-dev`
- **Replicas:** 1 per service
- **Storage:** 10Gi (PostgreSQL), 2Gi (Redis)
- **Autoscaling:** 1-3 replicas
- **Domain:** `dev.multi-agent-platform.example.com`

### Staging (`staging`)

- **Namespace:** `multi-agent-platform-staging`
- **Replicas:** 2 per service
- **Storage:** 30Gi (PostgreSQL), 5Gi (Redis)
- **Autoscaling:** 2-6 replicas (API/Web), 2-10 (Workers)
- **Domain:** `staging.multi-agent-platform.example.com`

### Production (`production`)

- **Namespace:** `multi-agent-platform`
- **Replicas:** 3 per service
- **Storage:** 50Gi (PostgreSQL), 10Gi (Redis)
- **Autoscaling:** 3-10 replicas (API/Web), 3-20 (Workers)
- **Domain:** `multi-agent-platform.example.com`
- **Additional:** Pod Disruption Budgets, Priority Classes, Anti-affinity

## Cloud Providers

### AWS EKS

**Storage Class:** `gp3` (General Purpose SSD)

**Load Balancer:** AWS Application Load Balancer

**Additional Setup:**

```bash
# Install AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller//crds?ref=master"

# Install EBS CSI Driver
kubectl apply -k "github.com/kubernetes-sigs/aws-ebs-csi-driver/deploy/kubernetes/overlays/stable/?ref=master"
```

**Deploy:**

```bash
./scripts/deploy.sh -e production -c aws
```

### GCP GKE

**Storage Class:** `standard-rwo` (Persistent Disk)

**Load Balancer:** Google Cloud Load Balancer

**Additional Setup:**

```bash
# Enable Workload Identity
gcloud container clusters update CLUSTER_NAME \
  --workload-pool=PROJECT_ID.svc.id.goog

# Install GKE Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-gce/master/deploy/gce-ingress.yaml
```

**Deploy:**

```bash
./scripts/deploy.sh -e production -c gcp
```

### Azure AKS

**Storage Class:** `managed-premium` (Premium SSD)

**Load Balancer:** Azure Application Gateway

**Additional Setup:**

```bash
# Install Application Gateway Ingress Controller
helm repo add application-gateway-kubernetes-ingress https://appgwingress.blob.core.windows.net/ingress-azure-helm-package/
helm install ingress-azure application-gateway-kubernetes-ingress/ingress-azure

# Enable Azure Workload Identity
az aks update -n CLUSTER_NAME -g RESOURCE_GROUP --enable-workload-identity
```

**Deploy:**

```bash
./scripts/deploy.sh -e production -c azure
```

## Configuration

### Environment Variables

Environment-specific configurations are managed via ConfigMaps in each overlay:

```yaml
# k8s/overlays/production/kustomization.yaml
configMapGenerator:
  - name: app-config
    behavior: merge
    literals:
      - NODE_ENV=production
      - LOG_LEVEL=info
```

### Resource Limits

Default resource limits (production):

| Component | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-----------|-------------|----------------|-----------|--------------|
| API       | 500m        | 1Gi            | 2000m     | 4Gi          |
| Workers   | 500m        | 1Gi            | 2000m     | 4Gi          |
| Web       | 200m        | 512Mi          | 1000m     | 2Gi          |
| LiteLLM   | 500m        | 512Mi          | 2000m     | 2Gi          |
| PostgreSQL| 500m        | 1Gi            | 2000m     | 4Gi          |
| Redis     | 100m        | 256Mi          | 500m      | 2Gi          |

### Autoscaling

Horizontal Pod Autoscaler (HPA) is enabled by default:

- **API:** 3-10 replicas (70% CPU, 80% Memory)
- **Workers:** 3-20 replicas (70% CPU, 80% Memory)
- **Web:** 3-10 replicas (70% CPU, 80% Memory)

## Secrets Management

### Option 1: Kubernetes Secrets (Manual)

```bash
# Create secrets from file
kubectl create secret generic app-secrets \
  --from-env-file=.env.production \
  -n multi-agent-platform
```

### Option 2: External Secrets Operator (Recommended)

Install External Secrets Operator:

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace
```

Create ExternalSecret:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
  namespace: multi-agent-platform
spec:
  secretStoreRef:
    name: aws-secrets-manager  # or gcp-secret-manager, azure-key-vault
    kind: SecretStore
  target:
    name: app-secrets
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: multi-agent-platform/db-password
```

### Option 3: Sealed Secrets

```bash
# Install Sealed Secrets
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Create sealed secret
kubeseal --format yaml < secrets.yaml > sealed-secrets.yaml
kubectl apply -f sealed-secrets.yaml
```

## Monitoring

### Metrics

Prometheus metrics are exposed on port 9090 for all services:

- API metrics: `/metrics`
- Worker metrics: `/metrics`
- LiteLLM metrics: `/metrics` (port 9091)

### Dashboards

Grafana dashboards are provided in `k8s/base/monitoring/grafana-dashboards.yaml`:

1. **Platform Overview** - Overall system health
2. **LangGraph Metrics** - Agent execution metrics
3. **Model Performance** - AI model selection and performance

### Logs

Logs are output in JSON format to stdout/stderr and can be collected by:

- **EFK Stack** (Elasticsearch, Fluentd, Kibana)
- **Loki + Grafana**
- **Cloud-native solutions** (CloudWatch, Stackdriver, Azure Monitor)

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod POD_NAME -n multi-agent-platform

# Check logs
kubectl logs POD_NAME -n multi-agent-platform

# Check events
kubectl get events -n multi-agent-platform --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:16 --restart=Never -- \
  psql -h postgres-service.multi-agent-platform.svc.cluster.local -U postgres

# Check database pod logs
kubectl logs postgres-0 -n multi-agent-platform
```

### Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress main-ingress -n multi-agent-platform

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Check certificate
kubectl describe certificate platform-tls-cert -n multi-agent-platform
```

### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n multi-agent-platform

# Increase resource limits
kubectl set resources deployment/api \
  --limits=memory=8Gi \
  -n multi-agent-platform
```

### Scaling Issues

```bash
# Check HPA status
kubectl get hpa -n multi-agent-platform

# Describe HPA for details
kubectl describe hpa api-hpa -n multi-agent-platform

# Manually scale
./scripts/scale.sh -e production -c api -r 5
```

### Rollback Deployment

```bash
# Rollback to previous version
./scripts/rollback.sh -e production

# Rollback to specific revision
./scripts/rollback.sh -e production -r 3
```

## Maintenance

### Backup PostgreSQL

```bash
# Create backup job
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%Y%m%d-%H%M%S) \
  -n multi-agent-platform
```

### Update Secrets

```bash
# Edit secret
kubectl edit secret app-secrets -n multi-agent-platform

# Restart deployments to pick up new secrets
kubectl rollout restart deployment/api -n multi-agent-platform
kubectl rollout restart deployment/workers -n multi-agent-platform
```

### Drain Node for Maintenance

```bash
# Cordon node
kubectl cordon NODE_NAME

# Drain node
kubectl drain NODE_NAME --ignore-daemonsets --delete-emptydir-data

# After maintenance
kubectl uncordon NODE_NAME
```

## Security Best Practices

1. **Always use secrets** for sensitive data (never ConfigMaps)
2. **Enable Network Policies** to restrict pod-to-pod communication
3. **Use Pod Security Standards** (restricted mode in production)
4. **Enable RBAC** and follow principle of least privilege
5. **Scan images** for vulnerabilities before deployment
6. **Use TLS/SSL** for all external communication
7. **Rotate secrets** regularly
8. **Enable audit logging** on the cluster

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [Helm Documentation](https://helm.sh/docs/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Prometheus Operator](https://prometheus-operator.dev/)

## Support

For issues or questions:

- Open an issue in the repository
- Contact: team@multi-agent-platform.example.com
- Slack: #platform-support
