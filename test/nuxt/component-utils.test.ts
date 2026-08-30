import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RouteLocationNormalized } from 'vue-router'
import { getFragmentHTML, isChangingPage } from '../../packages/nuxt/src/app/components/utils'

describe('isChangingPage', () => {
  const component = {}
  function makeRoute (path: string, params: Record<string, unknown>, recordPath = '/files/:name'): RouteLocationNormalized {
    return {
      path,
      params,
      meta: {},
      matched: [{ path: recordPath, components: { default: component } }],
    } as unknown as RouteLocationNormalized
  }

  it('detects a param change between paths containing literal colons', () => {
    const to = makeRoute('/files/report:v1', { name: 'report:v1' })
    const from = makeRoute('/files/report:v2', { name: 'report:v2' })
    expect(isChangingPage(to, from)).toBe(true)
  })

  it('detects a plain param change', () => {
    const to = makeRoute('/files/a', { name: 'a' })
    const from = makeRoute('/files/b', { name: 'b' })
    expect(isChangingPage(to, from)).toBe(true)
  })

  it('returns false when only query changes', () => {
    const to = makeRoute('/files/a', { name: 'a' })
    const from = makeRoute('/files/a', { name: 'a' })
    expect(isChangingPage(to, from)).toBe(false)
  })
})

describe('getFragmentHTML', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('walks large fragments without overflowing the call stack', () => {
    const fragment = document.createDocumentFragment()
    const start = document.createComment('[')
    fragment.append(start)

    for (let i = 0; i < 20_000; i++) {
      const element = document.createElement('span')
      element.textContent = String(i)
      fragment.append(element)
    }

    fragment.append(document.createComment(']'))

    const html = getFragmentHTML(start)
    expect(html).toHaveLength(20_000)
    expect(html?.[0]).toBe('<span>0</span>')
    expect(html?.[19_999]).toBe('<span>19999</span>')
  })

  it('stops at the fragment boundary and clears island slot contents', () => {
    const fragment = document.createDocumentFragment()
    const start = document.createComment('[')
    const element = document.createElement('div')
    const slot = document.createElement('span')
    const ignored = document.createElement('p')

    slot.dataset.islandSlot = 'default'
    slot.textContent = 'slot content'
    element.append('before', slot, 'after')
    ignored.textContent = 'outside fragment'
    fragment.append(start, element, document.createComment(']'), ignored)

    expect(getFragmentHTML(start, true)).toEqual([
      '<div>before<span data-island-slot="default"></span>after</div>',
    ])
  })

  // cloning a live `<img>` starts a second load of its `src`
  it('does not clone live nodes', () => {
    const cloneNode = vi.spyOn(Node.prototype, 'cloneNode')

    const fragment = document.createDocumentFragment()
    const start = document.createComment('[')
    const withSlot = document.createElement('div')
    const withoutSlot = document.createElement('div')

    withSlot.innerHTML = '<img src="/island-asset.svg"><span data-island-slot="default">slot content</span>'
    withoutSlot.innerHTML = '<img src="/island-asset.svg">'
    fragment.append(start, withSlot, withoutSlot, document.createComment(']'))

    expect(getFragmentHTML(start, true)).toEqual([
      '<div><img src="/island-asset.svg"><span data-island-slot="default"></span></div>',
      '<div><img src="/island-asset.svg"></div>',
    ])
    expect(cloneNode).not.toHaveBeenCalled()
  })
})
