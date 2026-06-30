<template>
  <div class="card-group">
    <slot></slot>
  </div>
</template>

<style scoped>
.card-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  margin-bottom: 2rem;
}
</style>
