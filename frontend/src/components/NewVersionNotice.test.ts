import { describe, expect, it } from 'vitest'
import { entryScript } from './NewVersionNotice'

describe('entryScript', () => {
  it('reads the hashed entry a Vite build writes into index.html', () => {
    const html =
      '<head><link rel="modulepreload" href="/assets/vendor-aa11.js">' +
      '<script type="module" crossorigin src="/assets/index-B3xQ9k.js"></script></head>'
    expect(entryScript(html)).toBe('/assets/index-B3xQ9k.js')
  })

  /*
   * The dev server serves `/src/main.tsx`, not a hashed file. Returning null
   * there is what keeps the notice from firing on every local reload.
   */
  it('finds nothing on the dev server, so there is nothing to compare', () => {
    expect(entryScript('<script type="module" src="/src/main.tsx"></script>')).toBeNull()
  })
})
