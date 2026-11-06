# Recoil-Plus

Frida agent for **nullsbrawl** `v69.252` (iOS)

## Build

```
npm install esbuild
npx esbuild src/index.js --bundle --outfile=dist/agent.js --format=iife --platform=neutral --target=es2022 --minify
```

### License

**MIT**, see `LICENSE`
