#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo SSH_PORT=22 DEPLOY_USER=<user> $0" >&2
  exit 1
fi

deploy_user="${DEPLOY_USER:-${SUDO_USER:-}}"
ssh_port="${SSH_PORT:-22}"
if [[ -z "$deploy_user" || "$deploy_user" == "root" ]] || ! id "$deploy_user" >/dev/null 2>&1; then
  echo "DEPLOY_USER must name an existing non-root sudo user" >&2
  exit 1
fi
if ! [[ "$ssh_port" =~ ^[0-9]+$ ]] || ((ssh_port < 1 || ssh_port > 65535)); then
  echo "SSH_PORT must be a valid TCP port" >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$VERSION_CODENAME" "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.sources
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker "$deploy_user"
install -d -m 0750 -o "$deploy_user" -g "$deploy_user" /opt/revive-crm /srv/revive-crm/backups

ufw default deny incoming
ufw default allow outgoing
ufw allow "${ssh_port}/tcp" comment 'SSH'
ufw allow 80/tcp comment 'HTTP certificate redirect'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTP/3'
ufw --force enable
systemctl enable --now docker fail2ban unattended-upgrades

echo "Host bootstrap complete. Log out and back in so Docker group membership takes effect."
