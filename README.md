# NEXUS Platform Dashboard — Frontend Server

Angular 20 SPA — Dashboard de la plataforma NEXUS.
Autenticación vía Okta OIDC gestionada por Kong API Gateway.

---

## Arquitectura

```
[Browser]  →  http://<server-ip>:80  →  [Nginx + Angular SPA]
                                              ↓
                               click "Sign in with Okta"
                                              ↓
                        http://65.21.132.180:30800  (Kong)
                                              ↓
                               Kong gestiona OIDC con Okta
                                              ↓
                              Angular SPA cargada + autenticado
```

---

## Deploy en servidor Proxmox (Ubuntu 24.04)

### Metodo 1 — Script automatico (recomendado)

```bash
# En el servidor Proxmox (como root o con sudo)
curl -fsSL https://raw.githubusercontent.com/Infinitemind-im/frontend-server/main/deploy.sh | bash
```

### Metodo 2 — Manual

```bash
# 1. Instalar Docker (si no esta instalado)
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker

# 2. Clonar el repo
git clone https://github.com/Infinitemind-im/frontend-server.git /opt/nexus-frontend
cd /opt/nexus-frontend

# 3. Build y levantar
docker compose -f docker-compose.server.yml up -d --build

# 4. Verificar
docker compose -f docker-compose.server.yml ps
# Frontend disponible en http://<ip-del-servidor>:80
```

### Actualizar (cuando haya cambios en GitHub)

```bash
cd /opt/nexus-frontend
git pull origin main
docker compose -f docker-compose.server.yml up -d --build
```

---

## Requisitos del servidor

| Requisito | Minimo |
|-----------|--------|
| Ubuntu    | 22.04 / 24.04 |
| Docker    | 24.x+ |
| RAM       | 512 MB |
| Puerto    | 80 abierto |

---

## Configuracion Okta / Kong

| Variable | Valor |
|----------|-------|
| kongUrl  | http://65.21.132.180:30800 |
| m1Url    | http://65.21.132.180:30800/api/v1/m1 |

El frontend redirige a Kong al hacer login. Kong gestiona el OIDC con Okta server-side.

---

## Comandos Docker

```bash
docker compose -f docker-compose.server.yml ps          # Estado
docker compose -f docker-compose.server.yml logs -f     # Logs
docker compose -f docker-compose.server.yml down        # Parar
docker compose -f docker-compose.server.yml up -d --build  # Rebuild
```
