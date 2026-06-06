'use client'

import * as React from 'react'
import createCache from '@emotion/cache'
import type { EmotionCache } from '@emotion/cache'
import { useServerInsertedHTML } from 'next/navigation'
import { CacheProvider } from '@emotion/react'

/**
 * Coordinates Emotion's (MUI's styling engine) style insertion with Next's
 * App-Router SSR. Without this, Emotion emits `<style data-emotion>` elements
 * inline in the server-rendered tree, but the client renders the plain
 * elements without those tags — producing a hydration mismatch. We instead
 * collect the styles inserted during a render and flush them into the document
 * head via `useServerInsertedHTML`, so server and client markup agree.
 *
 * Mirrors the registry pattern documented in Next's CSS-in-JS guide
 * (node_modules/next/dist/docs/01-app/02-guides/css-in-js.md) and MUI's
 * manual App Router integration.
 */
export function EmotionRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache = createCache({ key: 'mui' })
    cache.compat = true
    const prevInsert = cache.insert
    let inserted: string[] = []
    cache.insert = (...args: Parameters<EmotionCache['insert']>) => {
      const serialized = args[1]
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name)
      }
      return prevInsert(...args)
    }
    const flush = () => {
      const prevInserted = inserted
      inserted = []
      return prevInserted
    }
    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) return null
    let styles = ''
    for (const name of names) {
      styles += cache.inserted[name]
    }
    return (
      <style
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return <CacheProvider value={cache}>{children}</CacheProvider>
}
