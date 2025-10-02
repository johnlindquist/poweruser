#!/bin/bash

# Claude Code proxy inspection script
# This script configures Claude Code to route through mitmproxy for traffic inspection

echo "🔧 Setting up Claude Code with mitmproxy inspection..."

# Configure Node to trust mitmproxy CA
export NODE_EXTRA_CA_CERTS="$HOME/.mitmproxy/mitmproxy-ca-cert.pem"

# Set proxy environment variables
export HTTPS_PROXY="http://127.0.0.1:8080"
export HTTP_PROXY="http://127.0.0.1:8080"

# Bypass local traffic from proxy
export NO_PROXY="localhost,127.0.0.1,.local"

# Enable debug logging (optional - comment out if too verbose)
export ANTHROPIC_LOG="debug"

echo "📡 Proxy configuration:"
echo "   HTTP_PROXY:  $HTTP_PROXY"
echo "   HTTPS_PROXY: $HTTPS_PROXY"
echo "   NO_PROXY:    $NO_PROXY"
echo "   CA Cert:     $NODE_EXTRA_CA_CERTS"
echo ""

# Check if mitmproxy is running
if ! pgrep -f "mitmproxy|mitmweb|mitmdump" > /dev/null; then
    echo "⚠️  mitmproxy is not running!"
    echo ""
    echo "Please start mitmproxy in another terminal first:"
    echo "  Option 1 (CLI):     mitmproxy --listen-host 127.0.0.1 --listen-port 8080"
    echo "  Option 2 (Web UI):  mitmweb --listen-host 127.0.0.1 --listen-port 8080"
    echo ""
    read -p "Press Enter once mitmproxy is running, or Ctrl+C to cancel..."
fi

echo "🚀 Launching Claude Code with proxy..."
echo ""
echo "💡 Tips:"
echo "  - Run '/status' in Claude Code to verify proxy settings"
echo "  - Watch mitmproxy terminal/web UI to see intercepted traffic"
echo "  - Press 'q' in mitmproxy to quit when done"
echo ""

# Launch Claude Code
claude "$@"