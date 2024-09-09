# Contributing

## Useful Scripts

### Watch and zip

```bash
while inotifywait -e close_write *; do zip -o out.zip -r options background.js LICENSE manifest.json; done
```
