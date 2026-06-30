import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { h } from 'vue'
import TerminalDemo from './TerminalDemo.vue'
import CardGroup from './components/CardGroup.vue'
import Card from './components/Card.vue'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(TerminalDemo)
    })
  },
  enhanceApp({ app }) {
    app.component('CardGroup', CardGroup)
    app.component('Card', Card)
  }
}
