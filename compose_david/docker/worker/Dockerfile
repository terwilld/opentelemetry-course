# Worker dev image for the UKG network (proxy re-signs TLS; PyPI/GitHub/HF need workarounds).
# Build secrets: art = Artifactory token, cabundle = corporate CA bundle (PEM).
# Build contexts: worker = app-versions/code/worker, models = repo root (Stanza model files).
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Trust the proxy CA for Python (GitHub / Argos index) at build time and at runtime
RUN --mount=type=secret,id=cabundle cp /run/secrets/cabundle /etc/corp-ca-bundle.pem
ENV SSL_CERT_FILE=/etc/corp-ca-bundle.pem \
    REQUESTS_CA_BUNDLE=/etc/corp-ca-bundle.pem

# Exact versions from uv.lock (stanza>=1.14 override), installed without resolving
# because argostranslate 1.11.0 pins stanza==1.10.1, which Artifactory curation blocks.
COPY requirements.txt ./
# torch: PyPI's Linux wheels are CUDA builds (torch 2.10 is curation-blocked), so use the
# CPU wheel from the Artifactory proxy of download.pytorch.org (direct URL; no index page there).
RUN --mount=type=secret,id=art \
    export TOKEN="$(cat /run/secrets/art)" && \
    pip install --no-cache-dir --no-deps \
      "https://david.terwilliger%40ukg.com:${TOKEN}@ukgartifactory.pe.jfrog.io/artifactory/download-pytorch-org-remote/whl/cpu/torch-2.11.0%2Bcpu-cp312-cp312-manylinux_2_28_$(uname -m).whl" && \
    export PIP_INDEX_URL="https://david.terwilliger%40ukg.com:${TOKEN}@ukgartifactory.pe.jfrog.io/artifactory/api/pypi/pypi/simple" && \
    pip install --no-cache-dir --no-deps -r requirements.txt && \
    pip install --no-cache-dir watchdog

# Argos language packages
COPY --from=worker download_models.py ./
RUN python download_models.py

# Stanza 1.15 models cannot be fetched from Hugging Face behind the proxy; use the committed copies
COPY --from=models combined_nocharlm.pt mwt_combined.pt /tmp/stanza-models/
RUN for p in /root/.local/share/argos-translate/packages/*/; do \
      mkdir -p "$p/stanza/en/tokenize" "$p/stanza/en/mwt" && \
      cp /tmp/stanza-models/combined_nocharlm.pt "$p/stanza/en/tokenize/combined_nocharlm.pt" && \
      cp /tmp/stanza-models/mwt_combined.pt "$p/stanza/en/mwt/combined.pt"; \
    done && rm -rf /tmp/stanza-models

# Source code is mounted as a volume

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "src.main"]
