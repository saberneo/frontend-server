#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Script de deploy para servidor Proxmox (Ubuntu 24.04)
#
# Uso (sin sudo — desplegado en el home del usuario actual):
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Si Docker no está instalado, el script pide sudo solo para esa parte.
# El resto corre como usuario normal en ~/nexus-frontend
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_URL="https://github.com/saberneo/frontend-server.git"
# Usar el directorio home del usuario actual — no requiere sudo
APP_DIR="$HOME/nexus-frontend"
COMPOSE_FILE="docker-compose.server.yml"

echo "========================================"
echo "  NEXUS Frontend — Deploy Script"
echo "========================================"
echo "  Usuario: $(whoami)"
echo "  Directorio: $APP_DIR"
echo "========================================"

# ── 1. Instalar Docker si no está instalado ───────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "[1/5] Instalando Docker (requiere sudo)..."
    sudo apt-get update -qq
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    # Añadir el usuario actual al grupo docker para no necesitar sudo
    sudo usermod -aG docker "$USER"
    echo "[1/5] Docker instalado ✓ (cierra sesión y vuelve a entrar si ves errores de permisos)"
else
    echo "[1/5] Docker ya instalado ✓"
fi

# ── 2. Clonar o actualizar el repositorio en ~/nexus-frontend ─────────────────
echo "[2/5] Clonando/actualizando repositorio en $APP_DIR ..."
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git pull origin main
    echo "[2/5] Repositorio actualizado ✓"
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
    echo "[2/5] Repositorio clonado ✓"
fi

# ── 3. Build de la imagen Docker ──────────────────────────────────────────────
echo "[3/5] Building imagen Docker (puede tardar 2-3 min la primera vez)..."
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" build --no-cache
echo "[3/5] Imagen construida ✓"

# ── 4. Levantar el contenedor ─────────────────────────────────────────────────
echo "[4/5] Levantando contenedor..."
docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d
echo "[4/5] Contenedor levantado ✓"

# ── 5. Verificar estado ───────────────────────────────────────────────────────
echo "[5/5] Verificando estado..."
sleep 5
docker compose -f "$COMPOSE_FILE" ps
echo ""
echo "========================================"
echo "  ✅ Deploy completado"
echo "  Frontend disponible en: http://$(hostname -I | awk '{print $1}'):8080"
echo "========================================"
