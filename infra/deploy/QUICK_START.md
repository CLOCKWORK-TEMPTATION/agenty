# Multi-Agent Platform - Quick Start Guide

## ⚡ 5-Minute Deployment to Development

```bash
# 1. Navigate to deployment directory
cd infra/deploy

# 2. Install cluster prerequisites
./scripts/setup-cluster.sh --all

# 3. Configure secrets (REQUIRED)
cd k8s/base
cp secrets.yaml secrets-local.yaml
# Edit secrets-local.yaml and fill in real values
vim secrets-local.yaml

# 4. Create secrets in cluster
kubectl create secret generic app-secrets \
  --from-file=secrets-local.yaml \
  --namespace multi-agent-platform-dev \
  --dry-run=client -o yaml | kubectl apply -f -

# 5. Deploy to dev
cd ../..
./scripts/deploy.sh -e dev

# 6. Verify deployment
kubectl get pods -n multi-agent-platform-dev
kubectl get ingress -n multi-agent-platform-dev

# 7. Access application
# Web: https://dev.multi-agent-platform.example.com
# API: https://dev-api.multi-agent-platform.example.com/health
```

## 🚀 Production Deployment (AWS EKS)

```bash
# 1. Prerequisites installed
./scripts/setup-cluster.sh --all

# 2. Configure production secrets
cd k8s/base
cp secrets.yaml secrets-production.yaml
vim secrets-production.yaml  # Fill in production values

# 3. Create secrets
kubectl create secret generic app-secrets \
  --from-file=secrets-production.yaml \
  --namespace multi-agent-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Update domain names
vim k8s/base/ingress.yaml
vim k8s/base/cert-manager.yaml
vim k8s/overlays/production/aws.yaml

# 5. Deploy to production on AWS
cd ../..
./scripts/deploy.sh -e production -c aws

# 6. Wait for rollout (5 minutes)
kubectl wait --for=condition=available --timeout=300s \
  deployment --all -n multi-agent-platform

# 7. Verify all components
kubectl get all -n multi-agent-platform

# 8. Check TLS certificate
kubectl get certificate -n multi-agent-platform

# 9. Access application
# Web: https://multi-agent-platform.example.com
# API: https://api.multi-agent-platform.example.com
```

## 📦 Helm Deployment (Alternative)

```bash
# 1. Create namespace
kubectl create namespace multi-agent-platform

# 2. Create secrets
kubectl create secret generic app-secrets \
  --from-env-file=.env.production \
  -n multi-agent-platform

# 3. Customize values
vim helm/multi-agent-platform/values.yaml

# 4. Install with Helm
helm install multi-agent-platform ./helm/multi-agent-platform \
  --namespace multi-agent-platform \
  --values helm/multi-agent-platform/values.yaml

# 5. Check status
helm status multi-agent-platform -n multi-agent-platform
```

## 🔧 Essential Commands

### View Status
```bash
# All resources
kubectl get all -n multi-agent-platform

# Pods
kubectl get pods -n multi-agent-platform

# Services
kubectl get svc -n multi-agent-platform

# Ingress
kubectl get ingress -n multi-agent-platform

# HPA
kubectl get hpa -n multi-agent-platform
```

### View Logs
```bash
# API logs
kubectl logs -f deployment/api -n multi-agent-platform

# Workers logs
kubectl logs -f deployment/workers -n multi-agent-platform

# All recent logs
kubectl logs --tail=100 -l app.kubernetes.io/name=api -n multi-agent-platform
```

### Debugging
```bash
# Describe pod
kubectl describe pod POD_NAME -n multi-agent-platform

# Shell into pod
kubectl exec -it deployment/api -n multi-agent-platform -- /bin/sh

# Events
kubectl get events -n multi-agent-platform --sort-by='.lastTimestamp'

# Resource usage
kubectl top pods -n multi-agent-platform
```

### Scaling
```bash
# Scale API to 5 replicas
./scripts/scale.sh -e production -c api -r 5

# Scale all to 3
./scripts/scale.sh -e production -c all -r 3

# Manual scaling
kubectl scale deployment/api --replicas=5 -n multi-agent-platform
```

### Updates
```bash
# Update image
kubectl set image deployment/api \
  api=ghcr.io/multi-agent-platform/api:v1.1.0 \
  -n multi-agent-platform

# Check rollout
kubectl rollout status deployment/api -n multi-agent-platform

# Rollback
./scripts/rollback.sh -e production
```

## 🔐 Secrets Configuration

### Required Secrets (14 total)

```bash
# Database
DB_USER=postgres
DB_PASSWORD=<generate-secure-password>

# Redis
REDIS_PASSWORD=<generate-secure-password>

# JWT
JWT_SECRET=<generate-32-char-secret>
JWT_REFRESH_SECRET=<generate-32-char-secret>

# Encryption
ENCRYPTION_KEY=<generate-32-byte-key>

# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
COHERE_API_KEY=...
MISTRAL_API_KEY=...

# LiteLLM
LITELLM_MASTER_KEY=<generate-key>

# Session & Webhooks
SESSION_SECRET=<generate-secret>
WEBHOOK_SECRET=<generate-secret>
```

### Generate Secure Secrets

```bash
# Generate random password
openssl rand -base64 32

# Generate 32-byte key
openssl rand -hex 32

# Generate UUID
uuidgen
```

## 📊 Monitoring Access

### Prometheus
```bash
# Port-forward
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Access: http://localhost:9090
```

### Grafana
```bash
# Port-forward
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# Access: http://localhost:3000
# Default credentials: admin / prom-operator
```

### Application Metrics
```bash
# API metrics
kubectl port-forward -n multi-agent-platform svc/api-service 9090:9090

# Access: http://localhost:9090/metrics
```

## 🔍 Health Checks

### Quick Health Check
```bash
# API health
curl https://api.multi-agent-platform.example.com/health

# Expected response: {"status":"ok","timestamp":"..."}
```

### Component Status
```bash
# PostgreSQL
kubectl exec -it postgres-0 -n multi-agent-platform -- \
  psql -U postgres -c "SELECT version();"

# Redis
kubectl exec -it redis-0 -n multi-agent-platform -- \
  redis-cli -a <password> ping

# LiteLLM
curl http://litellm-service.multi-agent-platform.svc.cluster.local:4000/health
```

## 📁 Key Files Reference

| File | Purpose | When to Edit |
|------|---------|--------------|
| `k8s/base/configmap.yaml` | App config | Changing settings |
| `k8s/base/secrets.yaml` | Secrets template | First setup |
| `k8s/base/ingress.yaml` | Domain & routing | Changing domains |
| `k8s/overlays/*/kustomization.yaml` | Environment config | Per-env settings |
| `helm/*/values.yaml` | Helm values | Using Helm |
| `scripts/deploy.sh` | Deployment | Running deploy |

## 🚨 Troubleshooting Quick Fixes

### Pods Not Starting
```bash
# Check pod events
kubectl describe pod POD_NAME -n multi-agent-platform

# Check logs
kubectl logs POD_NAME -n multi-agent-platform

# Common issues:
# - ImagePullBackOff: Check image name/tag
# - CrashLoopBackOff: Check logs for errors
# - Pending: Check resource availability
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
kubectl get pods -n multi-agent-platform | grep postgres

# Test connection
kubectl exec -it deployment/api -n multi-agent-platform -- \
  nc -zv postgres-service 5432

# Check credentials
kubectl get secret app-secrets -n multi-agent-platform -o yaml
```

### Ingress Not Working
```bash
# Check ingress status
kubectl describe ingress main-ingress -n multi-agent-platform

# Check ingress controller
kubectl get pods -n ingress-nginx

# Check certificate
kubectl get certificate -n multi-agent-platform
```

### High Memory Usage
```bash
# Check current usage
kubectl top pods -n multi-agent-platform

# Increase limits
kubectl set resources deployment/api \
  --limits=memory=8Gi \
  -n multi-agent-platform
```

## 💡 Pro Tips

1. **Always use dry-run first**
   ```bash
   ./scripts/deploy.sh -e production --dry-run
   ```

2. **Tag images with versions, not 'latest'**
   ```yaml
   image: ghcr.io/multi-agent-platform/api:v1.0.0
   ```

3. **Monitor HPA behavior**
   ```bash
   kubectl get hpa -n multi-agent-platform -w
   ```

4. **Use External Secrets in production**
   - More secure than K8s secrets
   - Integrates with cloud secret managers

5. **Set up alerts for critical metrics**
   - Pod restarts > 5
   - Response time p95 > 5s
   - Queue depth > 1000

## 📚 Next Steps

After successful deployment:

1. ✅ Configure DNS records to point to Ingress IP
2. ✅ Set up CI/CD pipeline for automated deployments
3. ✅ Configure monitoring alerts in Prometheus
4. ✅ Set up log aggregation (EFK or Loki)
5. ✅ Implement backup automation
6. ✅ Document runbooks for common issues
7. ✅ Schedule security audits
8. ✅ Plan disaster recovery procedures

## 🆘 Need Help?

- 📖 Full Documentation: `README.md`
- 📋 Deployment Guide: `DEPLOYMENT_GUIDE.md`
- 📊 Summary: `SUMMARY.md`
- 📇 File Index: `INDEX.md`
- ✅ Validation: `VALIDATION.md`

**Support:** team@multi-agent-platform.example.com

---

**Happy Deploying! 🚀**
