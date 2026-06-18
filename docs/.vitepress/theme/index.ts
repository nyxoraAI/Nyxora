import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import TerminalDemo from './TerminalDemo.vue'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(TerminalDemo)
    })
  }
}
