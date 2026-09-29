# syntax=docker/dockerfile:1
# Optional: Schulnetz mit TLS-Inspektion → Zertifikat als Build-Secret „extra_ca“ übergeben (siehe README).
FROM python:3.12-slim-bookworm
RUN --mount=type=secret,id=extra_ca,required=false \
    APT_OPTS=""; \
    if [ -s /run/secrets/extra_ca ]; then \
      sed -i 's#http://deb.debian.org#https://deb.debian.org#g' /etc/apt/sources.list.d/debian.sources; \
      APT_OPTS="-o Acquire::https::CAInfo=/run/secrets/extra_ca"; \
    fi; \
    apt-get $APT_OPTS update && apt-get $APT_OPTS install -y --no-install-recommends ffmpeg libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --uid 10001 --create-home guide && mkdir -p /data/uploads && chown -R guide /data && chmod 700 /data/uploads && mkdir -p /models && chown guide /models
WORKDIR /app
COPY pyproject.toml ./
COPY guide_worker ./guide_worker
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then \
      cat "$(python -c 'import pip._vendor.certifi as c; print(c.where())')" /run/secrets/extra_ca > /tmp/ca.pem; \
      export PIP_CERT=/tmp/ca.pem; \
    fi; \
    pip install --no-cache-dir ".[pipeline]"; rm -f /tmp/ca.pem
USER guide
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "guide_worker"]
