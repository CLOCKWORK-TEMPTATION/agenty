# Multi-Agent Platform - Complete Deployment Guide

## Directory Structure

```
infra/deploy/
├── k8s/                                    # Kubernetes manifests
│   ├── base/                              # Base manifests (shared across environments)
│   │   ├── namespace.yaml                 # Namespace definition
│   │   ├── configmap.yaml                 # Application configuration
│   │   ├── secrets.yaml                   # Secrets template (DO NOT commit with real values)
│   │   ├── ingress.yaml                   # Ingress for external access
│   │   ├── cert-manager.yaml              # TLS certificate management
│   │   ├── network-policy.yaml            # Network security policies
│   │   ├── pod-security.yaml              # Pod security standards
│   │   ├── kustomization.yaml             # Kustomize configuration
│   │   │
│   │   ├── postgres/                      # PostgreSQL database
│   │   │   ├── postgres-pvc.yaml          # Persistent volume claim (50Gi)
│   │   │   ├── postgres-statefulset.yaml  # StatefulSet with pgvector
│   │   │   └── postgres-service.yaml      # Headless service
│   │   │
│   │   ├── redis/                         # Redis cache & queue
│   │   │   ├── redis-pvc.yaml             # Persistent volume claim (10Gi)
│   │   │   ├── redis-statefulset.yaml     # StatefulSet with persistence
│   │   │   └── redis-service.yaml         # Headless service
│   │   │
│   │   ├── litellm/                       # LiteLLM proxy
│   │   │   ├── litellm-configmap.yaml     # LiteLLM configuration
│   │   │   ├── litellm-deployment.yaml    # Deployment (3 replicas)
│   │   │   └── litellm-service.yaml       # Service
│   │   │
│   │   ├── api/                           # API backend
│   │   │   ├── api-deployment.yaml        # Deployment (3 replicas)
│   │   │   ├── api-service.yaml           # Service
│   │   │   └── api-hpa.yaml               # Horizontal Pod Autoscaler (3-10)
│   │   │
│   │   ├── workers/                       # Background workers
│   │   │   ├── workers-deployment.yaml    # Deployment (3 replicas)
│   │   │   └── workers-hpa.yaml           # HPA (3-20)
│   │   │
│   │   ├── web/                           # Next.js frontend
│   │   │   ├── web-deployment.yaml        # Deployment (3 replicas)
│   │   │   ├── web-service.yaml           # Service
│   │   │   └── web-hpa.yaml               # HPA (3-10)
│   │   │
│   │   └── monitoring/                    # Monitoring configuration
│   │       ├── prometheus-config.yaml     # Prometheus scrape configs
│   │       ├── servicemonitor.yaml        # ServiceMonitor CRDs
│   │       └── grafana-dashboards.yaml    # Pre-configured dashboards
│   │
│   └── overlays/                          # Environment-specific configurations
│       ├── dev/                           # Development environment
│       │   └── kustomization.yaml         # Dev overrides (1 replica, 10Gi storage)
│       │
│       ├── staging/                       # Staging environment
│       │   └── kustomization.yaml         # Staging overrides (2 replicas, 30Gi storage)
│       │
│       └── production/                    # Production environment
│           ├── kustomization.yaml         # Production config (3+ replicas, 50Gi storage)
│           ├── pod-disruption-budget.yaml # PDB for high availability
│           ├── priority-class.yaml        # Pod priority classes
│           ├── service-account.yaml       # Service accounts
│           ├── aws.yaml                   # AWS EKS specific config
│           ├── gcp.yaml                   # GCP GKE specific config
│           ├── gcp-backend-config.yaml    # GCP backend config
│           ├── gcp-managed-cert.yaml      # GCP managed certificates
│           └── azure.yaml                 # Azure AKS specific config
│
├── helm/                                  # Helm chart (alternative deployment method)
│   └── multi-agent-platform/
│       ├── Chart.yaml                     # Chart metadata
│       ├── values.yaml                    # Default values (customizable)
│       ├── .helmignore                    # Files to ignore
│       └── templates/                     # Helm templates (auto-generated from K8s manifests)
│
├── scripts/                               # Deployment automation scripts
│   ├── deploy.sh                          # Main deployment script
│   ├── rollback.sh                        # Rollback to previous version
│   ├── scale.sh                           # Scale components
│   └── setup-cluster.sh                   # Install cluster prerequisites
│
├── README.md                              # Comprehensive documentation
├── DEPLOYMENT_GUIDE.md                    # This file
└── .gitignore                             # Ignore secrets and temp files
```

## Pre-Deployment Checklist

### 1. Cluster Requirements

- [ ] Kubernetes 1.28+ cluster running
- [ ] kubectl configured and connected to cluster
- [ ] At least 3 worker nodes for HA
- [ ] Storage provisioner available (dynamic PV provisioning)
- [ ] Ingress controller installed (NGINX recommended)
- [ ] cert-manager installed (for TLS)
- [ ] Metrics server installed (for HPA)

### 2. Install Prerequisites

Run the setup script to install required components:

```bash
cd infra/deploy/scripts

# Install all components
./setup-cluster.sh --all

# Or install individually
./setup-cluster.sh --ingress-nginx --cert-manager --metrics-server
```

### 3. Configure Secrets

**CRITICAL:** Never commit real secrets to version control!

```bash
# Copy secrets template
cd infra/deploy/k8s/base
cp secrets.yaml secrets-local.yaml

# Edit and fill in real values
vim secrets-local.yaml
```

Required secrets:
- `DB_USER` - PostgreSQL username
- `DB_PASSWORD` - PostgreSQL password
- `REDIS_PASSWORD` - Redis password
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `ENCRYPTION_KEY` - 32-byte encryption key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Google AI API key
- `COHERE_API_KEY` - Cohere API key
- `MISTRAL_API_KEY` - Mistral API key
- `LITELLM_MASTER_KEY` - LiteLLM master key
- `SESSION_SECRET` - Session secret
- `WEBHOOK_SECRET` - Webhook secret

### 4. Update Domain Names

Edit the following files to replace `example.com` with your actual domain:

```bash
# Ingress
vim k8s/base/ingress.yaml

# Certificate
vim k8s/base/cert-manager.yaml

# Environment overlays
vim k8s/overlays/dev/kustomization.yaml
vim k8s/overlays/staging/kustomization.yaml
vim k8s/overlays/production/kustomization.yaml
```

### 5. Configure Cloud Provider (Optional)

If deploying to a specific cloud provider, update the respective configuration:

**AWS EKS:**
```bash
vim k8s/overlays/production/aws.yaml
# Update: ACCOUNT_ID, REGION, CERTIFICATE_ID
```

**GCP GKE:**
```bash
vim k8s/overlays/production/gcp.yaml
# Update: PROJECT_ID
```

**Azure AKS:**
```bash
vim k8s/overlays/production/azure.yaml
# Update: CLIENT_ID, TENANT_ID
```

## Deployment Steps

### Option A: Deploy with Kustomize (Recommended)

#### Development Environment

```bash
cd infra/deploy

# Preview manifests
kustomize build k8s/overlays/dev

# Deploy
./scripts/deploy.sh -e dev

# Or manually
kustomize build k8s/overlays/dev | kubectl apply -f -
```

#### Staging Environment

```bash
./scripts/deploy.sh -e staging
```

#### Production Environment

```bash
# Generic Kubernetes
./scripts/deploy.sh -e production

# AWS EKS
./scripts/deploy.sh -e production -c aws

# GCP GKE
./scripts/deploy.sh -e production -c gcp

# Azure AKS
./scripts/deploy.sh -e production -c azure
```

### Option B: Deploy with Helm

```bash
cd infra/deploy

# Development
helm install multi-agent-platform-dev ./helm/multi-agent-platform \
  --namespace multi-agent-platform-dev \
  --create-namespace \
  --set global.environment=dev

# Staging
helm install multi-agent-platform-staging ./helm/multi-agent-platform \
  --namespace multi-agent-platform-staging \
  --create-namespace \
  --set global.environment=staging

# Production
helm install multi-agent-platform ./helm/multi-agent-platform \
  --namespace multi-agent-platform \
  --create-namespace \
  --values helm/multi-agent-platform/values.yaml
```

## Post-Deployment Verification

### 1. Check Pod Status

```bash
# All pods should be Running
kubectl get pods -n multi-agent-platform

# Expected output:
# NAME                       READY   STATUS    RESTARTS   AGE
# api-xxx                    1/1     Running   0          2m
# workers-xxx                1/1     Running   0          2m
# web-xxx                    1/1     Running   0          2m
# litellm-xxx                1/1     Running   0          2m
# postgres-0                 1/1     Running   0          2m
# redis-0                    1/1     Running   0          2m
```

### 2. Check Services

```bash
kubectl get svc -n multi-agent-platform

# Expected services:
# - api-service (ClusterIP)
# - web-service (ClusterIP)
# - litellm-service (ClusterIP)
# - postgres-service (ClusterIP/Headless)
# - redis-service (ClusterIP/Headless)
```

### 3. Check Ingress

```bash
kubectl get ingress -n multi-agent-platform

# Should show your domain with ADDRESS populated
```

### 4. Check TLS Certificate

```bash
kubectl get certificate -n multi-agent-platform

# Should show READY=True
```

### 5. Test Endpoints

```bash
# Health check
curl https://api.multi-agent-platform.example.com/health

# Web frontend
curl https://multi-agent-platform.example.com
```

### 6. Check HPA

```bash
kubectl get hpa -n multi-agent-platform

# All HPAs should be active
```

### 7. Check Logs

```bash
# API logs
kubectl logs -f deployment/api -n multi-agent-platform

# Worker logs
kubectl logs -f deployment/workers -n multi-agent-platform

# Web logs
kubectl logs -f deployment/web -n multi-agent-platform
```

## Common Operations

### Scaling Components

```bash
# Scale API to 5 replicas
./scripts/scale.sh -e production -c api -r 5

# Scale all components to 3 replicas
./scripts/scale.sh -e production -c all -r 3

# Scale workers to 10 replicas
./scripts/scale.sh -e production -c workers -r 10
```

### Updating Configuration

```bash
# Edit ConfigMap
kubectl edit configmap app-config -n multi-agent-platform

# Restart deployments to apply changes
kubectl rollout restart deployment/api -n multi-agent-platform
kubectl rollout restart deployment/workers -n multi-agent-platform
```

### Updating Secrets

```bash
# Edit secrets
kubectl edit secret app-secrets -n multi-agent-platform

# Or update from file
kubectl create secret generic app-secrets \
  --from-env-file=.env.production \
  --namespace multi-agent-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart to apply
kubectl rollout restart deployment/api -n multi-agent-platform
```

### Rolling Updates

```bash
# Update image version
kubectl set image deployment/api \
  api=ghcr.io/multi-agent-platform/api:v1.1.0 \
  -n multi-agent-platform

# Check rollout status
kubectl rollout status deployment/api -n multi-agent-platform

# View rollout history
kubectl rollout history deployment/api -n multi-agent-platform
```

### Rollback

```bash
# Rollback to previous version
./scripts/rollback.sh -e production

# Rollback to specific revision
./scripts/rollback.sh -e production -r 3

# Rollback specific component
kubectl rollout undo deployment/api -n multi-agent-platform
```

### Database Migrations

```bash
# Run migrations manually
kubectl exec -it deployment/api -n multi-agent-platform -- pnpm run db:migrate

# Create migration job
kubectl create job db-migrate-manual \
  --from=cronjob/db-migrate \
  -n multi-agent-platform
```

### Viewing Metrics

```bash
# Port-forward to Prometheus
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Port-forward to Grafana
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# Access:
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/prom-operator)
```

### Debugging

```bash
# Shell into API pod
kubectl exec -it deployment/api -n multi-agent-platform -- /bin/sh

# Shell into database
kubectl exec -it postgres-0 -n multi-agent-platform -- psql -U postgres

# Shell into Redis
kubectl exec -it redis-0 -n multi-agent-platform -- redis-cli -a <password>

# View events
kubectl get events -n multi-agent-platform --sort-by='.lastTimestamp'

# Describe pod for issues
kubectl describe pod <pod-name> -n multi-agent-platform
```

## Monitoring & Observability

### Metrics Endpoints

- **API:** `http://api-service:9090/metrics`
- **Workers:** `http://workers-pod:9090/metrics`
- **LiteLLM:** `http://litellm-service:9091/metrics`

### Grafana Dashboards

Three pre-configured dashboards are included:

1. **Platform Overview** - System health and resource usage
2. **LangGraph Metrics** - Agent execution and graph performance
3. **Model Performance** - AI model selection and response times

### Alerts

Configure alerts in Prometheus for:

- Pod restarts > 5 in 10 minutes
- API response time p95 > 5 seconds
- Queue depth > 1000 items
- Database connection pool exhausted
- Memory usage > 90%
- Disk usage > 85%

## Backup & Recovery

### PostgreSQL Backup

```bash
# Manual backup
kubectl exec postgres-0 -n multi-agent-platform -- \
  pg_dump -U postgres multi_agent_platform > backup-$(date +%Y%m%d).sql

# Restore
kubectl exec -i postgres-0 -n multi-agent-platform -- \
  psql -U postgres multi_agent_platform < backup-20240101.sql
```

### Redis Backup

```bash
# Trigger RDB snapshot
kubectl exec redis-0 -n multi-agent-platform -- redis-cli -a <password> BGSAVE

# Copy RDB file
kubectl cp multi-agent-platform/redis-0:/data/dump.rdb ./redis-backup.rdb
```

## Security Considerations

1. **Secrets Management**
   - Use External Secrets Operator in production
   - Rotate secrets regularly (quarterly)
   - Never commit secrets to git

2. **Network Policies**
   - Already configured to restrict pod-to-pod communication
   - Only allows necessary connections

3. **Pod Security**
   - Enforces restricted Pod Security Standards
   - Runs as non-root user
   - Drops all capabilities

4. **RBAC**
   - Service accounts created for API and Workers
   - Configure cloud provider workload identity

5. **TLS/SSL**
   - All external traffic encrypted
   - cert-manager handles certificate renewal

6. **Image Security**
   - Scan images before deployment
   - Use specific tags (not `latest`)
   - Pull from trusted registries only

## Cost Optimization

### Development

- 1 replica per service
- Smaller storage (10Gi)
- Lower resource limits
- Estimated cost: ~$200-300/month

### Staging

- 2 replicas per service
- Medium storage (30Gi)
- Medium resource limits
- Estimated cost: ~$500-700/month

### Production

- 3+ replicas with autoscaling
- Full storage (50Gi)
- Full resource limits
- Estimated cost: ~$1500-2500/month

**Cost Reduction Tips:**

1. Use spot/preemptible instances for workers
2. Enable cluster autoscaler
3. Right-size resource requests/limits
4. Use reserved instances for stable workloads
5. Enable aggressive HPA scale-down

## Support & Troubleshooting

For issues:

1. Check [README.md](./README.md) Troubleshooting section
2. Review pod logs: `kubectl logs <pod-name> -n multi-agent-platform`
3. Check events: `kubectl get events -n multi-agent-platform`
4. Contact: team@multi-agent-platform.example.com

## Next Steps

After successful deployment:

1. ✅ Configure DNS records
2. ✅ Set up monitoring alerts
3. ✅ Configure backup automation
4. ✅ Set up CI/CD pipeline
5. ✅ Document runbooks
6. ✅ Train operations team
7. ✅ Plan disaster recovery
8. ✅ Schedule regular security audits
