# OpenTelemetry for Observability: The Complete Course

This repository contains all the code, lab guides, and supporting materials for my **OpenTelemetry for Observability: The Complete Course** course.

### ➡️ Course link (with a big discount 🙂): [https://www.lauromueller.com/courses/opentelemetry-observability](https://www.lauromueller.com/courses/opentelemetry-observability)

### Check my other courses:

- 👉 [Argo CD and Argo Rollouts for GitOps: The Definitive Guide](https://www.lauromueller.com/courses/argo-cd-rollouts)
- 👉 [Prompt Engineering for Developers: The Definitive Guide](https://www.lauromueller.com/courses/prompt-engineering)
- 👉 [Python for DevOps: Mastering Real-World Automation](https://www.lauromueller.com/courses/python-devops)
- 👉 [The Complete Docker and Kubernetes Course: From Zero to Hero](https://www.lauromueller.com/courses/docker-kubernetes)
- 👉 [The Definitive Helm Course: From Beginner to Master](https://www.lauromueller.com/courses/definitive-helm-course)
- 👉 [Mastering Terraform: From Beginner to Expert](https://www.lauromueller.com/courses/mastering-terraform)
- 👉 [Mastering GitHub Actions: From Beginner to Expert](https://www.lauromueller.com/courses/mastering-github-actions)
- 👉 [Write better code: 20 code smells and how to get rid of them](https://www.lauromueller.com/courses/writing-clean-code)

## Welcome!

I'm really glad to have you here! This repository is the hands-on companion for the course. Everything you need to follow along — the demo application, Docker Compose and Kubernetes configurations, and step-by-step lab guides — lives here.

The course is built around a realistic async translation service (**Translation Queue**) composed of a Node.js frontend, a Python worker, and Redis. You will instrument this application from scratch using OpenTelemetry, progressively adding metrics, traces, and logs across both services until you have full end-to-end observability.

## 🗂️ Repository Structure

```
.
├── app-versions/        # Versioned ZIP snapshots of the demo application
├── compose/             # Docker Compose files and observability stack configs
├── compose_david/       # My working stack for the UKG network (see "My Working Setup" below)
├── k8s/                 # Kubernetes manifests (bonus section)
└── labs/                # Step-by-step lab guides, organised by course section
    ├── section-setup/
    ├── section-single-system/
    ├── section-distributed-systems/
    └── section-kubernetes/
```

## 🚀 Getting Started

### Prerequisites

Before your first lab, make sure you have the following installed:

- **Docker** and **Docker Compose** — used throughout the course for running the application and observability stack locally
- **kubectl** — required for the Kubernetes bonus section
- A local Kubernetes cluster (**Kind**, **Minikube**, or **Docker Desktop**) — required for the bonus section only

Run through the setup lab to verify everything is in place:

👉 [`labs/section-setup/`](labs/section-setup/INDEX.md)

## 📚 Lab Sections

Work through the sections in order. Each section has an `INDEX.md` with a numbered list of labs.

### 1. Setup

Get your local environment ready and spin up the full observability stack (Prometheus, Loki, Tempo, Grafana) with Docker Compose.

👉 [`labs/section-setup/`](labs/section-setup/INDEX.md)

### 2. Single System Instrumentation

Instrument the Node.js frontend end-to-end: start with auto-instrumentation, then layer in custom business metrics, manual traces, structured logs, and log-to-trace correlation.

👉 [`labs/section-single-system/`](labs/section-single-system/INDEX.md)

### 3. Distributed Systems Observability

Instrument the Python worker and connect the two services through distributed tracing over Redis. By the end of this section, a single translation request will appear as one connected trace spanning the frontend and the worker.

👉 [`labs/section-distributed-systems/`](labs/section-distributed-systems/INDEX.md)

### 4. Deploying to Kubernetes _(Bonus)_

Take the fully instrumented application and deploy it — together with the complete observability stack — to a local Kubernetes cluster. You will write the manifests, wire them together with Kustomize, and verify that all three telemetry signals flow correctly in the new environment.

👉 [`labs/section-kubernetes/`](labs/section-kubernetes/INDEX.md)

## 🏗️ Application Versions

The demo application evolves across the course. Each lab section references a specific version — download the ZIP from the course platform and extract it to your working directory before starting the corresponding labs.

| Version    | Description                                                            | Docker Images                                                                                                                               |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1.1.0** | Baseline application — no OpenTelemetry instrumentation                | [frontend](https://hub.docker.com/r/lmacademy/web-translator-frontend) • [worker](https://hub.docker.com/r/lmacademy/web-translator-worker) |
| **v1.2.0** | Frontend fully instrumented — metrics, traces, and logs                | [frontend](https://hub.docker.com/r/lmacademy/web-translator-frontend) • [worker](https://hub.docker.com/r/lmacademy/web-translator-worker) |
| **v1.3.0** | Both frontend and worker fully instrumented — end-to-end observability | [frontend](https://hub.docker.com/r/lmacademy/web-translator-frontend) • [worker](https://hub.docker.com/r/lmacademy/web-translator-worker) |

Pre-built Docker images are available for every version and are tagged accordingly (e.g. `lmacademy/web-translator-frontend:v1.3.0`). Images are built for both `linux/amd64` and `linux/arm64`.

## 🛠️ My Working Setup (`compose_david/`)

This fork is my own walk through the labs. The stack I actually run lives in [`compose_david/`](compose_david/) and differs from the course material in a few ways, mostly because of the corporate (UKG) network. Everything below is a summary of those changes.

### Progress

Each lab is one branch and one pull request (`lab-N-…`). Done so far:

- Observability stack: Prometheus, Loki, Tempo, Grafana, OpenTelemetry Collector, and Grafana Alloy
- Baseline translation app (no instrumentation) deployed and running
- Frontend **metrics**: auto-instrumentation, then manual business metrics (`translation.*` counters and a duration histogram)
- Frontend **traces**: auto-instrumentation (HTTP, Express, ioredis), exported to the Collector and then Tempo
- In progress: manual traces (`lab-10-manual-traces`). The worker is not instrumented yet, so traces end at the Redis enqueue.

### Compose files

| File | Use |
| ---- | --- |
| `compose.observability.yaml` | The observability stack only (included by the others) |
| `compose.dev.yaml` | Day-to-day: frontend and worker built locally, with `src/` bind-mounted for hot reload |
| `compose.build.yaml` | Full rebuild with no host mounts (code baked into the images). Uses its own image tags (`translation-*:build`) so it doesn't overwrite the dev images. Same container names and ports as dev, so run one or the other |
| `compose.yaml`, `compose.app.yaml`, `compose.prod.yaml` | The course's originals. They run the **upstream** `lmacademy/web-translator-*:v1.1.0` images, which do not include my network fixes |

> **Watch out:** mixing compose files leaves you with the wrong image. If the worker fails with `CERTIFICATE_VERIFY_FAILED` against `raw.githubusercontent.com`, it is almost certainly the upstream image (started from `compose.yaml`). Recreate it from the dev file: `docker rm -f worker && docker compose -f compose.dev.yaml up -d --pull never worker`.

### Network workarounds

- **Docker Hub enforced sign-in:** pulls are blocked even for public images. Download with `skopeo`, `docker load` the tar, then use `--pull never`. Details are in `.claude/CLAUDE.md`.
- **Artifactory:** npm and PyPI go through the UKG Artifactory proxy, using a token from `~/.ssh/artifactory_token` (passed as a build secret, never written to the image). Its curation policy blocks some versions, which is why the OpenTelemetry packages are on 0.217.0 / `auto-instrumentations-node` 0.75.0 and not the versions pinned in the lab text.
- **TLS-intercepting proxy:** the worker image trusts the corporate CA bundle (`~/corp-ca-bundle.pem`, a build secret) through `SSL_CERT_FILE` and `REQUESTS_CA_BUNDLE`.
- **Worker models:** Stanza models can't be fetched from GitHub or Hugging Face behind the proxy, so the committed `combined_nocharlm.pt` and `mwt_combined.pt` are copied into the image. Torch comes from the Artifactory proxy of the CPU wheel index.
- **Frontend image:** multi-stage Dockerfile (`development`, `builder`, `production`) with the `production` stage used by `compose.build.yaml`.

### Port map (host)

| Port | Service |
| ---- | ------- |
| 3000 | Grafana |
| 3001 | Frontend (container port 3000) |
| 3100 / 3200 / 9090 | Loki / Tempo / Prometheus |
| 4317, 4318 | Collector OTLP (gRPC, HTTP) |
| 8888, 8889 | Collector own metrics, Prometheus exporter |
| 12345, 14317, 14318 | Alloy UI, Alloy OTLP (gRPC, HTTP) |
| 6379 | Redis |

To run the frontend on the host (`npm start`) alongside the containers, use a free port such as `PORT=3002`. Port 3000 is Grafana.

```bash
# Run the frontend on the host: free port, and point telemetry at the published Collector port
# (the default `otel-collector` hostname only resolves inside the Docker network).
# OTEL_SERVICE_NAME makes its traces distinguishable from the container's (default: translation-frontend).
# Rebuild first (`npm run build`): `npm start` runs the compiled dist/, not src/.
OTEL_SERVICE_NAME=translation-frontend-npm-start OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 PORT=3002 npm start
```

Find the host process's traces in Tempo with `{ resource.service.name = "translation-frontend-npm-start" }`.

I'm looking forward to seeing you in the course!
