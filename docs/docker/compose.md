# Docker Compose

## 最小示例

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"
```

## 常用命令

```bash
docker compose up -d
docker compose logs -f
docker compose down
```
