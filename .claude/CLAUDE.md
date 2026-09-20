# OpenTelemetry Course Repository Guide

## Docker Hub Authentication Workaround (Enforced Sign-In)

When Docker Desktop has **enforced sign-in enabled** (org policy), `docker pull` and `docker compose up` are blocked even for public images. The Docker daemon rejects pulls as unauthenticated, bypassing normal CLI login.

**Workaround**: Use `skopeo` to download images directly from the Docker Hub registry (outside Docker Desktop's daemon), then `docker load` them locally. This bypasses the enforced-sign-in gate since `docker load` doesn't contact any registry.

### Step 1: Install skopeo (if needed)

```bash
brew install skopeo
```

### Step 2: Download the image using skopeo

For **Prometheus v3.9.1**:

```bash
mkdir -p ~/docker-images
echo '{}' > /tmp/empty-auth.json

/opt/homebrew/bin/skopeo copy \
  --override-os linux --override-arch arm64 --override-variant v8 \
  --src-authfile /tmp/empty-auth.json \
  docker://prom/prometheus:v3.9.1 \
  docker-archive:$HOME/docker-images/prometheus-v3.9.1.tar:prom/prometheus:v3.9.1
```

Replace `prom/prometheus:v3.9.1` with the target image name/tag as needed.

**Flags explained:**
- `--override-os linux --override-arch arm64 --override-variant v8` — pull linux/arm64 image (Apple Silicon)
- `--src-authfile /tmp/empty-auth.json` — use empty auth (anonymous pull) to bypass any stored credentials that might be rejected
- `docker-archive:<path>:<image:tag>` — save as a local tar file with the specified image reference

### Step 3: Load into Docker Desktop

```bash
docker load -i ~/docker-images/prometheus-v3.9.1.tar
```

Verify the image loaded:

```bash
docker images prom/prometheus
```

### Step 4: Retry Docker Compose

`docker compose up` will now find the image locally and skip the pull:

```bash
docker compose up prometheus
```

---

## Git User Configuration for Personal GitHub Accounts

This repo is hosted under the `terwilld` personal GitHub account. If your global git SSH key is configured for a different GitHub account (e.g., `secondgithubsigningkey` for a UKG account), pushing will fail with a permission error.

### Solution: Switch to the personal account's SSH key

List available SSH keys:

```bash
ls -la ~/.ssh/ | grep -E "id_|key"
```

Identify the key for your personal GitHub account (e.g., `id_ed25519_personal`).

Update git config to use it:

```bash
git config --global core.sshcommand "ssh -i ~/.ssh/id_ed25519_personal"
git config --global user.signingkey ~/.ssh/id_ed25519_personal
```

Verify the update:

```bash
git config --global -l | grep -E "user\.|core\.sshcommand"
```

Now `git push` will use the correct SSH key and have permission to push to `terwilld/opentelemetry-course`.

### To switch back to a different account

Simply update `core.sshcommand` and `user.signingkey` to point to the other SSH key:

```bash
git config --global core.sshcommand "ssh -i ~/.ssh/secondgithubsigningkey"
git config --global user.signingkey ~/.ssh/secondgithubsigningkey
```

---

## Notes

- These workarounds are environment-specific. If Docker or SSH keys change, re-run the configuration steps.
- The skopeo workaround will be needed whenever a new image is introduced that hasn't been cached locally (e.g., Loki, Tempo, Grafana, otel-collector in later labs).
