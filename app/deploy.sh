#!/bin/bash
# Build and deploy React dashboard to the nginx-served directory
set -e
cd "$(dirname "$0")"
npm run build
sudo rm -f /var/www/openclaw-react/assets/index-*.js /var/www/openclaw-react/assets/index-*.css
sudo cp dist/assets/* /var/www/openclaw-react/assets/
sudo cp dist/index.html /var/www/openclaw-react/index.html
echo "✅ Deployed to /var/www/openclaw-react/"
