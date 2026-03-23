#!/bin/bash
set -euo pipefail

EC2_HOST="13.213.71.197"
EC2_USER="ec2-user"
SSH_KEY="/Volumes/PSSD/下载/文件/AWS/ADA.pem"
APP_DIR="/home/ec2-user/memepro"
RELEASE_DIR="$APP_DIR/releases/$(date +%Y%m%d-%H%M%S)"

echo "==> Building Next.js standalone..."
npm ci
npm run build

echo "==> Creating release archive..."
tar czf /tmp/memepro-release.tar.gz \
  .next/standalone \
  .next/static \
  public

echo "==> Uploading to EC2..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "mkdir -p $RELEASE_DIR"
scp -i "$SSH_KEY" /tmp/memepro-release.tar.gz "$EC2_USER@$EC2_HOST:$RELEASE_DIR/"

echo "==> Deploying with zero-downtime switch..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << 'REMOTE'
  set -euo pipefail
  RELEASE_DIR=$(ls -1td /home/ec2-user/memepro/releases/*/ | head -1)
  cd "$RELEASE_DIR"
  tar xzf memepro-release.tar.gz
  rm memepro-release.tar.gz

  # Copy static assets into standalone
  cp -r .next/static .next/standalone/.next/
  [ -d public ] && cp -r public .next/standalone/

  # Atomic symlink swap
  ln -sfn "$RELEASE_DIR/.next/standalone" /home/ec2-user/memepro/current_new
  mv -Tf /home/ec2-user/memepro/current_new /home/ec2-user/memepro/current

  # Restart via PM2
  pm2 restart memepro 2>/dev/null || pm2 start /home/ec2-user/memepro/current/server.js --name memepro

  # Health check
  sleep 3
  if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "Deploy successful!"
  else
    echo "Health check FAILED! Check logs with: pm2 logs memepro"
    exit 1
  fi

  # Keep only last 5 releases
  ls -1td /home/ec2-user/memepro/releases/*/ | tail -n +6 | xargs rm -rf 2>/dev/null || true
REMOTE

echo "==> Done!"
