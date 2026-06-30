<template>
  <component :is="href ? 'a' : 'div'" :href="href" class="fumadocs-card">
    <div v-if="icon" class="icon-wrapper">
      <span class="icon">{{ icon }}</span>
    </div>
    <div class="content">
      <h3 class="title" v-if="title">{{ title }}</h3>
      <div class="description">
        <slot></slot>
      </div>
    </div>
  </component>
</template>

<script setup>
defineProps({
  title: String,
  icon: String,
  href: String
})
</script>

<style scoped>
.fumadocs-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 1.5rem;
  background-color: var(--vp-c-bg-soft);
  transition: all 0.2s ease-in-out;
  text-decoration: none !important;
  color: inherit !important;
  height: 100%;
}

a.fumadocs-card:hover {
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg-mute);
}

.icon-wrapper {
  margin-bottom: 1rem;
}

.icon {
  font-size: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: var(--vp-c-default-soft);
  border-radius: 8px;
}

.title {
  margin: 0 0 0.5rem 0 !important;
  font-size: 1.125rem;
  font-weight: 600;
  border-top: none !important;
  padding-top: 0 !important;
  color: var(--vp-c-text-1);
}

.description {
  margin: 0 !important;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
</style>
