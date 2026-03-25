#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Script de deploy para servidor Proxmox (Ubuntu 24.04)
#
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Requisitos en el servidor:
#   - Docker instalado  (ver instrucciones en README.md)
#   - Git instalado
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_URL="https://github.com/Infinitemind-im/frontend-server.git"
APP_DIR="/opt/nexus-frontend"
COMPOSE_FILE="docker-compose.server.yml"

echo "========================================"
echo "  NEXUS Frontend — Deploy Script"
echo "========================================"

# ── 1. Instalar Docker si no está instalado ───────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "[1/5] Instalando Docker..."
    apt-get update -qq
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    echo "[1/5] Docker instalado ✓"
else
    echo "[1/5] Docker ya instalado ✓"
fi

# ── 2. Clonar o actualizar el repositorio ────────────────────────────────────
echo "[2/5] Clonando/actualizando repositorio..."
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git pull origin main
    echo "[2/5] Repositorio actualizado ✓"
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
    echo "[2/5] Repositorio clonado ✓"
fi

# ── 3. Build de la imagen Docker ─────────────────────────────────────────────
echo "[3/5] Building imagen Docker (puede tardar 2-3 min la primera vez)..."
docker compose -f "$COMPOSE_FILE" build --no-cache
echo "[3/5] Imagen construida ✓"

# ── 4. Levantar el contenedor ─────────────────────────────────────────────────
echo "[4/5] Levantando contenedor..."
docker compose -f "$COMPOSE_FILE" up -d
echo "[4/5] Contenedor levantado ✓"

# ── 5. Verificar estado ───────────────────────────────────────────────────────
echo "[5/5] Verificando estado..."
sleep 5
docker compose -f "$COMPOSE_FILE" ps
echo ""
echo "========================================"
echo "  ✅ Deploy completado"
echo "  Frontend disponible en: http://$(hostname -I | awk '{print $1}'):80"
echo "========================================"
