<template>
  <main>
    <p class="eyebrow">Study space</p>
    <h1>A quiet place to focus.</h1>
    <p>We’re preparing a place to study, together.</p>
  </main>
</template>

<style>
:root {
  color-scheme: dark;
  font-family: system-ui, sans-serif;
  background: #17251f;
  color: #f3f0e6;
}
body {
  margin: 0;
}
main {
  min-height: 100svh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: clamp(1.5rem, 8vw, 8rem);
}
h1 {
  max-width: 14ch;
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: 500;
  line-height: 1.08;
  margin: 0.4em 0;
}
p {
  max-width: 40ch;
  line-height: 1.6;
  color: #c5d2c8;
}
.eyebrow {
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.8rem;
}
:focus-visible {
  outline: 3px solid #e7c890;
  outline-offset: 4px;
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
