# Script Kit Performance Optimization Plan

**Date:** 2025-09-30
**Site:** https://www.scriptkit.com/
**Current LCP:** 1,095ms (Good, but can be improved)
**Target LCP:** <800ms (Excellent)

## Executive Summary

Chrome DevTools MCP analysis reveals a **1,052ms render delay** (96% of total LCP time) caused primarily by Monaco Editor loading and JavaScript bundle waterfall. While the site performs well overall (LCP: 1,095ms, CLS: 0.00), implementing these optimizations could reduce LCP by ~800-900ms.

---

## Current Performance Metrics

### Core Web Vitals
- **LCP:** 1,095ms ✅ (Good - under 2.5s threshold)
- **TTFB:** 42ms ✅ (Excellent)
- **CLS:** 0.00 ✅ (Perfect - no layout shifts)
- **Render Delay:** 1,052ms ❌ (Primary bottleneck)

### Network Overview
- **Total Requests:** 157
- **Third-Party Data:** 3.7MB from JSDelivr CDN (Monaco Editor)
- **JavaScript Chunks:** 26+ Next.js chunks loading sequentially
- **Server Response:** 1,110ms (target: <600ms)

---

## Root Causes Analysis

### 1. Monaco Editor (Highest Impact) 🔴
**Problem:**
- 3.7MB transferred from JSDelivr CDN on initial page load
- Multiple resources loading synchronously:
  - `loader.js`
  - `editor.main.js`
  - `editor.main.css`
  - `editor.main.nls.js`
- Loads on homepage even though editor isn't immediately needed
- 42ms main thread processing time

**Impact:** Estimated 500-700ms render delay

### 2. JavaScript Bundle Waterfall 🟡
**Problem:**
- 26+ separate Next.js chunks loading sequentially
- Chunk dependency chain creates waterfall effect
- Examples of chunks:
  - `webpack-9459756b6942eea4.js`
  - `e6c152c4-6e82ed141f7f88e5.js`
  - `5469-2b763877657b0cd3.js`
  - `main-app-8ff759343995f14d.js`
  - `c556396d-a3a1fbfa795f9349.js`
  - ... and 21+ more

**Impact:** Estimated 200-300ms render delay

### 3. Third-Party Scripts 🟡
**Problem:**
- Vercel Analytics & Speed Insights load during critical render window (815-1,043ms)
- Block main thread during initial page load

**Impact:** Estimated 50-100ms render delay

### 4. Server Response Time 🟠
**Problem:**
- Document response: 1,110ms (target: <600ms, ideal: <100ms)
- Already using Brotli compression ✅
- Already using HTTP/2 ✅
- No redirects ✅

**Impact:** Potential 500ms improvement if optimized

---

## Optimization Plan

### Phase 1: Critical Path (Highest ROI)

#### 1.1 Defer Monaco Editor Loading
**Priority:** 🔴 Critical
**Estimated Savings:** 500-700ms
**Effort:** Medium

**Implementation:**
```tsx
// Current (loads immediately):
import 'monaco-editor@0.43.0/min/vs/loader.js'

// Proposed (lazy load on interaction):
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  {
    ssr: false,
    loading: () => <CodeEditorSkeleton />
  }
)

// Only load when user clicks "Try Code" or scrolls to code example
useEffect(() => {
  if (isEditorVisible) {
    // Monaco will load here
  }
}, [isEditorVisible])
```

**Alternative Approach:**
- Use a lightweight syntax highlighter (Prism.js ~2KB) for static code display
- Load Monaco only when user clicks "Edit" or "Run Code"
- Consider using `next/script` with `strategy="lazyOnload"`

**Testing:**
```bash
# Before
npm run build && npm run analyze

# After changes
npm run build && npm run analyze
# Verify Monaco is in separate chunk loaded on-demand
```

---

#### 1.2 Optimize JavaScript Bundle Strategy
**Priority:** 🔴 Critical
**Estimated Savings:** 200-300ms
**Effort:** Medium-High

**Current Issue:**
- 26+ separate chunks create waterfall effect
- Many small chunks increase HTTP overhead
- Chunk dependency chain blocks rendering

**Implementation Steps:**

1. **Analyze Current Bundle**
```bash
npm install -D @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // existing config
})

# Run analysis
ANALYZE=true npm run build
```

2. **Consolidate Related Chunks**
```js
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Combine small vendor chunks
          default: false,
          vendors: false,
          // Create strategic chunks
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              // Group by package name
              const packageName = module.context.match(
                /[\\/]node_modules[\\/](.*?)([\\/]|$)/
              )[1]
              return `npm.${packageName.replace('@', '')}`
            },
            priority: 30,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
        },
      }
    }
    return config
  },
}
```

3. **Route-Based Code Splitting**
```tsx
// app/layout.tsx - Only load what's needed for homepage
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Suspense fallback={<LoadingSpinner />}>
          {children}
        </Suspense>
      </body>
    </html>
  )
}

// Lazy load heavy components
const ScriptList = dynamic(() => import('@/components/ScriptList'), {
  loading: () => <ScriptListSkeleton />,
})
```

**Target:**
- Reduce chunks from 26+ to 8-12 strategic chunks
- Inline critical CSS and JS (< 14KB)
- Defer non-critical chunks

---

#### 1.3 Defer Third-Party Analytics
**Priority:** 🟡 High
**Estimated Savings:** 50-100ms
**Effort:** Low

**Implementation:**
```tsx
// app/layout.tsx - Current
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

// Proposed - Load after page interactive
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}

        {/* Load analytics after page is interactive */}
        <Script
          src="/_vercel/insights/script.js"
          strategy="lazyOnload"
        />
        <Script
          src="/_vercel/speed-insights/script.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}
```

**Alternative Using Components:**
```tsx
// Use official components with strategy prop
<Analytics mode="production" />
<SpeedInsights />

// Move to separate client component loaded after hydration
'use client'
import { useEffect, useState } from 'react'

export function DeferredAnalytics() {
  const [load, setLoad] = useState(false)

  useEffect(() => {
    // Load after 2 seconds or on interaction
    const timer = setTimeout(() => setLoad(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!load) return null

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
```

---

### Phase 2: Server Optimization (Medium Priority)

#### 2.1 Investigate Server Response Time
**Priority:** 🟡 High
**Estimated Savings:** 300-500ms
**Effort:** Medium-High

**Current Issue:**
- Document response: 1,110ms (failed benchmark: should be <600ms)
- TTFB is excellent (42ms), so delay is in document generation

**Investigation Steps:**

1. **Add Server Timing Headers**
```ts
// middleware.ts or API route
export function middleware(request: NextRequest) {
  const start = Date.now()

  const response = NextResponse.next()

  const duration = Date.now() - start
  response.headers.set('Server-Timing', `total;dur=${duration}`)

  return response
}
```

2. **Check Data Fetching**
```tsx
// Look for blocking data fetches on homepage
// Example issue:
export default async function Home() {
  // This blocks page response
  const scripts = await fetch('/api/scripts?sort=createdAt&page=1')

  // Better: Use streaming or client-side fetch
  return <ScriptList initialData={null} />
}
```

3. **Potential Optimizations:**

**Option A: Streaming SSR**
```tsx
// app/page.tsx
import { Suspense } from 'react'

export default function Home() {
  return (
    <>
      <Hero /> {/* Render immediately */}

      <Suspense fallback={<ScriptListSkeleton />}>
        <ScriptList /> {/* Stream when ready */}
      </Suspense>
    </>
  )
}
```

**Option B: Edge Runtime**
```tsx
// app/page.tsx
export const runtime = 'edge' // Use Vercel Edge Functions

// Or for specific routes
// app/api/scripts/route.ts
export const runtime = 'edge'
```

**Option C: Incremental Static Regeneration (ISR)**
```tsx
// app/page.tsx
export const revalidate = 60 // Revalidate every 60 seconds

export default async function Home() {
  const scripts = await getScripts()
  return <ScriptList scripts={scripts} />
}
```

**Option D: Cache API Responses**
```ts
// app/api/scripts/route.ts
export async function GET(request: Request) {
  const scripts = await getScriptsFromDB()

  return NextResponse.json(scripts, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  })
}
```

---

### Phase 3: Fine-Tuning (Lower Priority)

#### 3.1 Optimize Image Loading Strategy
**Priority:** 🟢 Medium
**Estimated Savings:** 20-50ms
**Effort:** Low

**Current:**
- 60+ GitHub avatar images loading as `_next/image`
- Good: Already using Next.js Image optimization
- Issue: Many images load during initial page load

**Optimization:**
```tsx
// Current
<Image
  src={avatar}
  width={32}
  height={32}
  alt={name}
/>

// Proposed - Lazy load below-the-fold avatars
<Image
  src={avatar}
  width={32}
  height={32}
  alt={name}
  loading="lazy" // Add explicit lazy loading
  placeholder="blur" // Add blur placeholder
  blurDataURL="data:image/svg+xml..." // Inline tiny SVG
/>

// Better - Use intersection observer for manual control
'use client'
import { useInView } from 'react-intersection-observer'

export function Avatar({ src, alt }) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px' // Load 200px before visible
  })

  return (
    <div ref={ref}>
      {inView ? (
        <Image src={src} alt={alt} width={32} height={32} />
      ) : (
        <div className="avatar-skeleton" />
      )}
    </div>
  )
}
```

---

#### 3.2 Optimize Font Loading
**Priority:** 🟢 Low
**Estimated Savings:** 10-20ms
**Effort:** Low

**Current Status:**
- ✅ Font preloading enabled (`<link rel=preload>`)
- ✅ Using `.woff2` format
- 🟡 Could optimize display strategy

**Optimization:**
```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // or 'optional' for fastest render
  preload: true,
  variable: '--font-inter',
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

**CSS Alternative:**
```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: optional; /* Fastest - use fallback if font not ready */
  src: url('/fonts/inter.woff2') format('woff2');
}
```

---

#### 3.3 Implement Resource Hints
**Priority:** 🟢 Low
**Estimated Savings:** 20-30ms
**Effort:** Low

**Implementation:**
```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* DNS prefetch for external domains */}
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />

        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />

        {/* Prefetch next page for faster navigation */}
        <link rel="prefetch" href="/docs" />
        <link rel="prefetch" href="/api/scripts?page=2" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

---

## Implementation Timeline

### Week 1: Quick Wins
- [ ] Defer Vercel Analytics/Speed Insights (2 hours)
- [ ] Add lazy loading to images below fold (3 hours)
- [ ] Implement resource hints (1 hour)
- [ ] Run bundle analyzer (1 hour)

**Expected Impact:** 70-150ms LCP improvement

### Week 2: Major Optimizations
- [ ] Implement Monaco Editor lazy loading (1 day)
- [ ] Optimize JavaScript bundle strategy (2 days)
- [ ] Add streaming/suspense boundaries (1 day)

**Expected Impact:** 500-800ms LCP improvement

### Week 3: Server Optimization
- [ ] Add server timing instrumentation (2 hours)
- [ ] Investigate API response times (1 day)
- [ ] Implement caching strategy (1-2 days)
- [ ] Test Edge runtime migration (1 day)

**Expected Impact:** 300-500ms LCP improvement

### Week 4: Testing & Validation
- [ ] Performance testing across devices
- [ ] Real User Monitoring (RUM) setup
- [ ] A/B test changes
- [ ] Document performance budget

---

## Success Metrics

### Target Goals
| Metric | Current | Target | Stretch |
|--------|---------|--------|---------|
| LCP | 1,095ms | <800ms | <500ms |
| TTFB | 42ms ✅ | <100ms | <50ms |
| CLS | 0.00 ✅ | 0.00 | 0.00 |
| TBT | Unknown | <200ms | <100ms |
| FID | Unknown | <100ms | <50ms |
| Bundle Size | Unknown | <200KB | <150KB |
| Total Requests | 157 | <100 | <75 |

### Monitoring

**Before Changes:**
```bash
# Capture baseline metrics
npx lighthouse https://www.scriptkit.com --output=json --output-path=./baseline.json

# Or use WebPageTest
# https://www.webpagetest.org/
```

**After Changes:**
```bash
# Compare metrics
npx lighthouse https://www.scriptkit.com --output=json --output-path=./optimized.json

# Diff results
node compare-lighthouse.js baseline.json optimized.json
```

**Continuous Monitoring:**
- Set up Vercel Speed Insights alerts
- Configure CrUX dashboard for field data
- Add performance budgets to CI/CD:

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 800 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.01 }],
        "total-byte-weight": ["error", { "maxNumericValue": 500000 }]
      }
    }
  }
}
```

---

## Testing Checklist

### Before Deployment
- [ ] Run Lighthouse CI in staging
- [ ] Test on slow 3G connection
- [ ] Test on mobile devices (iOS/Android)
- [ ] Verify all interactions still work (especially Monaco editor)
- [ ] Check bundle size didn't increase
- [ ] Validate analytics still tracking
- [ ] Test with disabled JavaScript (progressive enhancement)

### Performance Testing Commands
```bash
# Local lighthouse audit
npx lighthouse https://localhost:3000 --view

# With throttling (simulates slow connection)
npx lighthouse https://localhost:3000 --throttling-method=devtools --throttling.cpuSlowdownMultiplier=4

# Mobile simulation
npx lighthouse https://localhost:3000 --preset=mobile --view

# Desktop simulation
npx lighthouse https://localhost:3000 --preset=desktop --view
```

---

## Risk Assessment

### Low Risk ✅
- Deferring analytics scripts
- Adding lazy loading to images
- Resource hints
- Font display optimization

### Medium Risk ⚠️
- JavaScript bundle restructuring (test thoroughly)
- Monaco Editor lazy loading (ensure code examples still work)
- Server-side caching (watch for stale data)

### High Risk 🔴
- Edge runtime migration (compatibility issues)
- Major Next.js config changes (build failures)
- Streaming SSR (hydration mismatches)

**Mitigation:**
- Feature flags for gradual rollout
- A/B testing (10% → 50% → 100%)
- Rollback plan documented
- Staging environment testing

---

## Questions for Team

1. **Monaco Editor Usage:**
   - What percentage of users interact with code editor?
   - Can we show static code (Prism.js) initially and load Monaco on-demand?

2. **API Response Time:**
   - Is `/api/scripts` hitting database directly?
   - Can we add Redis caching layer?
   - Is pagination working correctly?

3. **Server Response (1,110ms):**
   - What's happening during document generation?
   - Any slow data fetches or processing?
   - Can we use ISR or Edge runtime?

4. **Bundle Strategy:**
   - Are there shared dependencies that could be extracted?
   - What's the target bundle size per page?

5. **Analytics Requirements:**
   - Do we need real-time analytics on page load?
   - Can we defer to after-interactive?

---

## Resources

### Tools Used for Analysis
- Chrome DevTools MCP - Performance trace analysis
- Chrome DevTools Protocol - Network waterfall inspection

### Recommended Tools
- [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer) - Bundle size analysis
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) - Automated performance testing
- [WebPageTest](https://www.webpagetest.org/) - Real-world performance testing
- [Vercel Speed Insights](https://vercel.com/docs/speed-insights) - Real user monitoring

### Documentation
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web.dev - Optimize LCP](https://web.dev/articles/optimize-lcp)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [Monaco Editor Performance](https://github.com/microsoft/monaco-editor/wiki/Monaco-Editor-Performance)

---

## Contact

**Analysis Date:** 2025-09-30
**Analyzed By:** Chrome DevTools MCP Performance Trace
**Questions/Feedback:** Share with team for review and prioritization

---

## Appendix: Raw Performance Data

### Network Request Summary
- **Total Requests:** 157
- **Document:** 1 (1,110ms response time)
- **JavaScript:** 53 chunks
- **Stylesheets:** 2
- **Images:** 60+ (avatars)
- **Fonts:** 2 (.woff2)
- **API Calls:** 1 (`/api/scripts`)
- **Third-Party:** Monaco Editor (3.7MB)

### Critical Requests Timeline
```
0ms     - Navigation start
0.8ms   - Document request sent
1,110ms - Document download complete
1,134ms - Document processing complete
1,095ms - LCP (text element rendered)
```

### LCP Breakdown
- **TTFB:** 42ms (3.9% of LCP)
- **Render Delay:** 1,052ms (96.1% of LCP) ← PRIMARY ISSUE
- **Resource Load:** 0ms (text element, not network resource)

### Third-Party Impact
- **JSDelivr CDN:** 3.7MB transferred, 42ms main thread time
- **Vercel Analytics:** Loading during critical render window (815-1,043ms)

---

**Next Steps:** Review plan with team, prioritize phases, assign owners, schedule sprint planning.
