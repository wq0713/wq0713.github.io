# GitHub Pages 个人技术博客（MkDocs Material）

这个仓库用于发布 `https://用户名.github.io/` 的静态博客，文章使用 Markdown 编写。

## 本地预览

```bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
mkdocs serve
```

浏览器打开控制台提示的地址即可。

## 文章怎么放

- 把 Markdown 放到 `docs/` 目录下（可以按目录分类）
- 导航由文件夹结构自动生成（无需维护 `nav`）
  - 顶部主目录（Tab）：对应 `docs/` 下的一级目录（例如 `docs/docker/`、`docs/java/`）
  - 左侧子目录：对应目录内的 Markdown 文件与子目录
  - 每个目录建议放一个 `index.md` 作为该目录“概览页”
  - 页面标题默认取 Markdown 的第一个 `# 标题`
  - 如需自定义排序/隐藏某些页面，可在对应目录加一个可选的 `.pages` 文件（awesome-pages 插件）

## 发布到 用户名.github.io

1. 在 GitHub 新建仓库，仓库名必须是：`用户名.github.io`
2. 把本项目推送到该仓库的 `main` 分支
3. 修改 `mkdocs.yml` 里的：
   - `site_url` 改成 `https://用户名.github.io/`
   - `repo_name / repo_url` 改成你的仓库地址
4. 等待 GitHub Actions 跑完后，去仓库 Settings → Pages：
   - Build and deployment → Source 选择 `Deploy from a branch`
   - Branch 选择 `gh-pages` / `/ (root)`

之后用 `https://用户名.github.io/` 访问即可。
