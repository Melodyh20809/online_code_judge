# Deployment Guide
## Deployment Path (Cloud-Native)

Here’s a practical progression: **Docker -> Kubernetes -> Cloud managed K8s + CI/CD**.

---

## 1) Containerize the app with Docker

### Step 1: Add a production `Dockerfile`
Use a multi-stage build for smaller images.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### Step 2: Add `.dockerignore`
```gitignore
node_modules
.next
.git
.env*
npm-debug.log
```

### Step 3: Build and test locally
```bash
docker build -t online-code-test:latest .
docker run --rm -p 3000:3000 online-code-test:latest
```
Open `http://localhost:3000`.

---

## 2) Push image to a registry

### Step 4: Tag + push (Docker Hub example)
```bash
docker tag online-code-test:latest <dockerhub-username>/online-code-test:v1
docker push <dockerhub-username>/online-code-test:v1
```

(You can use GHCR, ECR, or GCR similarly.)

---

## 3) Deploy to Kubernetes

### Step 5: Create K8s manifests

`k8s/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: online-code-test
spec:
  replicas: 2
  selector:
    matchLabels:
      app: online-code-test
  template:
    metadata:
      labels:
        app: online-code-test
    spec:
      containers:
        - name: app
          image: <dockerhub-username>/online-code-test:v1
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: NEXTAUTH_URL
              value: "http://example.com"
            - name: NEXTAUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: NEXTAUTH_SECRET
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 20
            periodSeconds: 20
```

`k8s/service.yaml`
```yaml
apiVersion: v1
kind: Service
metadata:
  name: online-code-test-svc
spec:
  selector:
    app: online-code-test
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

`k8s/ingress.yaml` (if Ingress controller installed)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: online-code-test-ingress
spec:
  rules:
    - host: online-code-test.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: online-code-test-svc
                port:
                  number: 80
```

### Step 6: Create secret
```bash
kubectl create secret generic app-secrets \
  --from-literal=NEXTAUTH_SECRET='replace-with-secure-value'
```

### Step 7: Apply manifests
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Step 8: Verify
```bash
kubectl get pods
kubectl get svc
kubectl get ingress
kubectl logs deploy/online-code-test
```

---

## 4) Local K8s test options

- **Minikube** or **kind** for local cluster testing.
- With Minikube:
  ```bash
  minikube start
  kubectl apply -f k8s/
  minikube service online-code-test-svc
  ```

---

## 5) Production cloud-native setup (recommended)

### Step 9: Choose managed Kubernetes
- AWS EKS / GCP GKE / Azure AKS.

### Step 10: Add core platform components
- **Ingress Controller**: NGINX Ingress
- **TLS certs**: cert-manager + Let’s Encrypt
- **Autoscaling**: HPA
- **Observability**: Prometheus + Grafana (+ Loki optional)
- **External secrets**: cloud secret manager integration

### Step 11: Add CI/CD
Typical pipeline:
1. Run tests/lint
2. Build Docker image
3. Push image to registry
4. Update K8s deploy (`kubectl set image` or Helm upgrade)

GitHub Actions is a common choice.

---

## 6) Better deployment management (Helm)

As complexity grows, convert manifests into a Helm chart:
- `values.yaml` for image tag, env vars, replicas, domain, resources
- deploy with:
  ```bash
  helm upgrade --install online-code-test ./helm/online-code-test -n app --create-namespace
  ```

---

## 7) Practical notes for your current app

- Your app currently uses mock data (`src/data/mockDb.json`), so deployment is straightforward.
- If you later add DB/auth:
  - move secrets to K8s Secrets / cloud secret manager
  - avoid baking secrets into image
  - add migration/init jobs if needed.
- Your repo has existing lint/build issues in unrelated files; for production pipeline, either:
  - fix them, or
  - scope CI build to the deployable app path/branch strategy.

---

If you want, I can generate a ready-to-use `Dockerfile` + `k8s/` folder tailored to this exact repository structure (including health checks, ingress host, and environment variables).

