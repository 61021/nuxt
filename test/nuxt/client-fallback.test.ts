import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import NuxtClientFallbackServer from '../../packages/nuxt/src/app/components/client-fallback.server'
import NuxtClientFallbackClient from '../../packages/nuxt/src/app/components/client-fallback.client'

vi.mock('../../packages/nuxt/src/app/composables/state', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../packages/nuxt/src/app/composables/state')>()
  return { ...mod, useState: () => ref(true) }
})

const Boom = defineComponent({
  setup: () => () => { throw new Error('boom') },
})

describe('NuxtClientFallback server render', () => {
  const renderFailed = (slots: Record<string, () => unknown>) => {
    const app = createSSRApp(defineComponent({
      setup: () => () => h(NuxtClientFallbackServer, {}, { default: () => [h(Boom)], ...slots }),
    }))
    return renderToString(app)
  }

  it('renders the slot the client side prefers when both slots are passed', async () => {
    const html = await renderFailed({
      fallback: () => h('div', 'fallback slot'),
      placeholder: () => h('div', 'placeholder slot'),
    })
    expect(html).toContain('placeholder slot')
    expect(html).not.toContain('fallback slot')
  })

  it('renders the fallback slot when it is the only slot passed', async () => {
    const html = await renderFailed({
      fallback: () => h('div', 'fallback slot'),
    })
    expect(html).toContain('fallback slot')
  })
})

describe('NuxtClientFallback client render', () => {
  it('prefers the placeholder slot when both slots are passed', async () => {
    const wrapper = await mountSuspended(NuxtClientFallbackClient, {
      props: { keepFallback: true },
      slots: {
        default: () => h('div', 'default content'),
        fallback: () => h('div', 'fallback slot'),
        placeholder: () => h('div', 'placeholder slot'),
      },
    })
    expect(wrapper.html()).toContain('placeholder slot')
    expect(wrapper.html()).not.toContain('fallback slot')
  })

  it('renders fallthrough attributes on the string fallback like the server does', async () => {
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(
        NuxtClientFallbackClient,
        { keepFallback: true, fallbackTag: 'span', fallback: 'error content', class: 'fallback-cls' },
        { default: () => h('div', 'default content') },
      ),
    }))
    expect(wrapper.html()).toBe('<span class="fallback-cls">error content</span>')
  })
})
