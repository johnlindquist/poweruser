# Chrome DevTools MCP (Model Context Protocol)

## Overview

Chrome DevTools MCP is a public preview MCP server that brings Chrome DevTools capabilities to AI coding assistants. It allows AI agents to debug web pages directly in Chrome, transforming them from code generators into active debugging partners with "eyes in the browser."

**Published:** September 23, 2025
**Authors:** Mathias Bynens, Michael Hablich
**Repository:** https://github.com/ChromeDevTools/chrome-devtools-mcp
**Package:** `chrome-devtools-mcp@latest`

## What It Solves

Coding agents face a fundamental problem: they cannot see what the code they generate actually does when it runs in the browser. They're effectively "programming with a blindfold on." Chrome DevTools MCP changes this by giving AI assistants direct access to Chrome's debugging and automation capabilities.

## Architecture

**Layered Design:**
1. **MCP Server** - Handles requests from LLMs/agents
2. **Tool Adapter Layer** - Maps high-level MCP requests to Chrome DevTools Protocol (CDP) or Puppeteer APIs
3. **Chrome Runtime** - Performs all low-level browser actions
4. **Data Collection & Transfer** - Serializes trace, stack, HAR, and snapshot data

**Technical Foundation:**
- Built with Node.js
- Uses Puppeteer/Chrome Remote Interface backend
- Supports headless and GUI browser modes
- Communicates via WebSocket/stdio
- Standardized response formatting via McpResponse

## Core Capabilities

### 26 Tools Across 6 Categories:

#### 1. Input Automation
- Click, double-click, drag elements
- Fill forms and text inputs
- Select dropdown options
- File uploads
- Keyboard input and shortcuts
- Hover interactions

#### 2. Navigation
- Navigate to URLs
- Browser history (back/forward)
- Page refresh
- Multi-tab management
- Dialog handling (alerts, confirms, prompts)

#### 3. Performance Analysis
- `performance_start_trace` - Record performance traces
- `performance_stop_trace` - End trace recording
- `performance_analyze_insight` - Deep dive into specific insights
- Extract Core Web Vitals:
  - Largest Contentful Paint (LCP)
  - First Input Delay (FID)
  - Cumulative Layout Shift (CLS)
- Main thread task analysis
- JavaScript execution profiling
- Resource loading patterns
- Generate heap and DOM snapshots
- Access traceEvents for precise timing/call stacks

#### 4. Debugging
- `evaluate_script` - Execute custom JavaScript in page context
- `take_snapshot` - Capture DOM structure with element UIDs
- `take_screenshot` - Visual captures (full page or specific elements)
- Console message collection
- Error log inspection
- Network request analysis
- HAR (HTTP Archive) file generation

#### 5. Network Monitoring
- List all network requests by resource type
- Analyze individual requests
- Track third-party resources and APIs
- Diagnose CORS issues
- Monitor API calls and data sources
- Resource loading performance tracking

#### 6. Browser Emulation
- CPU throttling (1-20x slowdown)
- Network condition emulation:
  - Slow 3G
  - Fast 3G
  - Slow 4G
  - Fast 4G
- Viewport/window resizing
- Device simulation

## Installation & Setup

### Quick Start
```bash
claude mcp add chrome-devtools npx chrome-devtools-mcp@latest
```

### Manual Configuration
Add to your MCP client config:
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

### Test Installation
```
Please check the LCP of web.dev
```

### Compatible AI Assistants
- Claude Desktop & Claude Code
- Cursor
- VS Code extensions
- Gemini CLI
- JetBrains IDEs
- Any MCP-compatible client

## Use Cases

### 1. Verify Code Changes in Real-Time
Generate a fix with your AI agent, then automatically verify that the solution works as intended.

**Prompt:**
```
Verify in the browser that your change works as expected.
```

### 2. Diagnose Network and Console Errors
Analyze network requests to uncover CORS issues or inspect console logs to understand why features aren't working.

**Prompt:**
```
A few images on localhost:8080 are not loading. What's happening?
```

### 3. Simulate User Behavior
Navigate, fill out forms, and click buttons to reproduce bugs and test complex user flows.

**Prompt:**
```
Why does submitting the form fail after entering an email address?
```

### 4. Debug Live Styling and Layout Issues
Inspect DOM and CSS, get concrete suggestions to fix complex layout problems based on live browser data.

**Prompt:**
```
The page on localhost:8080 looks strange and off. Check what's happening there.
```

### 5. Automate Performance Audits
Run performance traces, analyze results, and investigate specific performance issues.

**Prompt:**
```
Localhost:8080 is loading slowly. Make it load faster.
```

### 6. SEO & Research Applications
- **SERP Feature Analysis** - Capture and analyze search results
- **Structured Data Extraction** - Extract title tags, meta descriptions, schema markup
- **Competitive Positioning** - Identify content opportunities
- **Longitudinal SERP Monitoring** - Track SERP changes over time
- **Algorithm Update Impact** - Monitor ranking shifts and seasonal patterns
- **Internal Linking Analysis** - Map site structure and navigation

### 7. Automated Page Load Analysis
Collect trace data, analyze main thread tasks and network requests, output actionable suggestions:
- Reduce blocking scripts
- Defer third-party resources
- Optimize resource loading
- Identify JavaScript bottlenecks

### 8. Testing & QA Automation
- Complex user flow reproduction
- Visual regression testing
- Cross-browser debugging
- Dynamic content validation
- Form submission testing
- Multi-step interaction scenarios

## Advanced Examples

### Performance Trace Analysis
```
Check the performance of https://developers.chrome.com and tell me the top 3 issues affecting load time.
```

The agent will:
1. Start Chrome with DevTools
2. Navigate to the URL
3. Record a performance trace
4. Analyze traceEvents and metrics
5. Identify blocking resources, long tasks, layout shifts
6. Provide specific recommendations with timing data

### Network Request Deep Dive
```
Analyze all API calls on localhost:3000 and identify any failing requests or slow endpoints.
```

The agent will:
1. Load the page
2. Capture all network requests
3. Filter by resource type (XHR, fetch)
4. Analyze response codes, timing, payloads
5. Report issues with specific URLs and suggestions

### JavaScript Execution & Data Extraction
```
Extract all product prices and availability from the e-commerce page at localhost:8080/products
```

The agent will:
1. Navigate to the page
2. Execute custom JavaScript to query DOM
3. Extract structured data
4. Return formatted results
5. Can also verify schema.org markup

### CPU & Network Throttling Testing
```
Test the mobile experience on localhost:8080 with slow 3G and 4x CPU throttling.
```

The agent will:
1. Enable network emulation (Slow 3G)
2. Enable CPU throttling (4x slowdown)
3. Record performance trace
4. Analyze mobile-specific issues
5. Report Core Web Vitals under constrained conditions

## Key Advantages

### For AI Agents
- **Visual feedback loop** - See what code actually does in the browser
- **Accurate debugging** - Access real runtime data, not assumptions
- **Comprehensive data** - Traces, network logs, console output, DOM snapshots
- **Reproducible testing** - Simulate exact user conditions

### For Developers
- **Automated verification** - Let AI test changes automatically
- **Performance insights** - Deep analysis without manual DevTools work
- **Bug reproduction** - AI can recreate and diagnose issues
- **Time savings** - Automate repetitive debugging tasks

### Compared to Other Automation Tools
- **Richer internal data** - Direct access to performance traces, stacks, network events
- **AI-native design** - Tools optimized for LLM interaction
- **Standardized responses** - Consistent error handling and formatting
- **Full DevTools integration** - Not just automation, but debugging capabilities

## Limitations & Considerations

- **Public Preview** - Active development, APIs may change
- **Resource intensive** - Launches real Chrome instances
- **Network dependent** - Requires internet for remote pages
- **Not a replacement** - Complements, doesn't replace manual testing

## Resources

- **Official Docs:** https://developer.chrome.com/blog/chrome-devtools-mcp
- **GitHub Repository:** https://github.com/ChromeDevTools/chrome-devtools-mcp
- **NPM Package:** https://www.npmjs.com/package/chrome-devtools-mcp
- **Tool Reference:** https://github.com/ChromeDevTools/chrome-devtools-mcp#tools
- **MCP Documentation:** https://modelcontextprotocol.io/
- **File Issues:** https://github.com/ChromeDevTools/chrome-devtools-mcp/issues

## Example Workflow

```
Developer: "The checkout page is loading slowly on localhost:3000/checkout"

Agent (using Chrome DevTools MCP):
1. Opens Chrome and navigates to localhost:3000/checkout
2. Starts performance trace with auto-reload
3. Analyzes trace data:
   - LCP: 4.2s (Poor)
   - Large JavaScript bundle: 2.1s parse time
   - Third-party analytics: 800ms blocking
   - CLS: 0.15 (layout shift from images)
4. Takes screenshot showing visual state
5. Examines network requests
6. Reviews console for errors

Agent Response:
"I found 4 performance issues:
1. main.bundle.js (890KB) blocks rendering for 2.1s - consider code splitting
2. analytics.js (220KB) is render-blocking - defer or async load
3. Product images lack width/height causing 0.15 CLS - add dimensions
4. Font loading causes FOIT - use font-display: swap

Your LCP is 4.2s, mainly due to #1 and #2. Fixing those should bring it under 2.5s."
```

## Community & Feedback

Chrome DevTools MCP is being built incrementally with community input. The team is actively seeking feedback on:
- Which capabilities to prioritize next
- Use cases and workflows
- Integration experiences
- Performance and reliability

**Share feedback:** https://github.com/ChromeDevTools/chrome-devtools-mcp/issues

---

**Last Updated:** 2025-09-30
**Status:** Public Preview
**License:** See repository for details
