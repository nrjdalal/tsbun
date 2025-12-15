## Clone this template

```bash
npx gitpick@latest nrjdalal/tsbun
```

## If you wish to run a server

```bash
npm i -D concurrently nodemon
npx fx '({
  ...this,
  scripts: {
    ...this.scripts,
    "dev": "tsdown && concurrently \"tsdown --watch\" \"nodemon dist/index.mjs\""
  }
})' package.json >package.tmp.json && mv package.tmp.json package.json
```
