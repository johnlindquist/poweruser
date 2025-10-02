# Claude Code Proxy Manager

A TypeScript/Bun application that manages mitmproxy and Claude Code together, allowing you to inspect all HTTPS traffic from Claude Code.

## Features

- 🚀 Automatic mitmproxy startup and management
- 🔐 Automatic CA certificate generation
- 🌐 Web UI or terminal UI options
- 🔧 Integrated environment variable configuration
- 🧹 Clean shutdown of both processes
- 📝 Full TypeScript with Bun runtime

## Prerequisites

- [Bun](https://bun.sh) installed
- mitmproxy installed (`brew install mitmproxy`)
- Claude Code CLI installed

## Installation

```bash
cd claude-proxy-manager
bun install
```

## Usage

### Quick Start (with Web UI)

```bash
bun start
```

This will:
1. Check for mitmproxy installation
2. Generate CA certificates if needed
3. Start mitmproxy with web UI (http://localhost:8081)
4. Launch Claude Code with proxy configuration
5. Clean up everything when you exit

### Terminal UI Mode

```bash
bun start:no-web
# or
bun run index.ts --no-web
```

### Custom Port

```bash
bun run index.ts --port 9090
```

### Pass Arguments to Claude Code

```bash
bun run index.ts -- --help  # Shows Claude Code help
bun run index.ts -- /path/to/project
```

### Development Mode (with file watching)

```bash
bun dev
```

## Scripts

- `bun start` - Start with default settings (web UI)
- `bun start:no-web` - Start with terminal UI
- `bun dev` - Start with file watching
- `bun help` - Show help message

## How It Works

1. **Certificate Management**: Automatically generates and trusts mitmproxy's CA certificate for Node.js
2. **Process Management**: Spawns both mitmproxy and Claude Code as child processes
3. **Environment Configuration**: Sets up `NODE_EXTRA_CA_CERTS`, `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`
4. **Graceful Shutdown**: Handles Ctrl+C to cleanly terminate both processes

## What You Can Inspect

- API calls to `api.anthropic.com`
- WebFetch requests
- Telemetry data
- Error reports
- All other HTTPS traffic from Claude Code

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--no-web` | Use terminal UI instead of web UI | Web UI |
| `--port PORT` | Proxy port | 8080 |
| `--help` | Show help message | - |

## Project Structure

```
claude-proxy-manager/
├── index.ts          # Main application
├── package.json      # Project configuration
├── tsconfig.json     # TypeScript config
├── bun.lockb         # Bun lockfile
└── README.md         # This file
```

## Troubleshooting

### mitmproxy not found
```bash
brew install mitmproxy
```

### Certificate issues
Delete `~/.mitmproxy` directory and let the app regenerate certificates:
```bash
rm -rf ~/.mitmproxy
bun start
```

### Proxy not working
In Claude Code, run `/status` to verify proxy settings are applied.

## License

MIT