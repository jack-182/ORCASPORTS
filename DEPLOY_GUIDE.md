# ORCA Conecta Sports — Guia de GitHub, Netlify & Firebase

## 1. Estrutura de Branches no GitHub
- `main`: ambiente de **produção** (protegida contra push direto; aceita apenas Pull Requests aprovados com CI verde).
- `development`: ambiente de **testes / homologação** (preview automático no Netlify).

### Comandos iniciais de organização
```bash
git checkout -b main
git add .
git commit -m "chore: setup ORCA Conecta Sports 100% real-time ecosystem"
git checkout -b development
```

### Proteção da branch `main` no GitHub
1. Acesse **Settings → Branches → Add branch protection rule**.
2. Em *Branch name pattern*, informe `main`.
3. Ative **Require a pull request before merging** e **Require status checks to pass before merging** (`Lint, Typecheck & Build`).

## 2. Configuração do Netlify (Sem Cache Antigo / Build Limpo)
O arquivo `netlify.toml` na raiz já define:
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **SPA Redirect:** `/* -> /index.html` (evita 404 ou tela branca ao navegar)
- **Cache-Control:** `no-cache, no-store, must-revalidate` para `/index.html` e cache imutável apenas para `/assets/*`.

### Variáveis de Ambiente no Netlify
Configure em **Site configuration → Environment variables**:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_ID`

### Branches & Clear Cache Automático
1. Em **Build & deploy → Branches and deploy contexts**, defina **Production branch** como `main` e **Branch deploys** como `development`.
2. Para deploy manual com limpeza completa de cache via GitHub Actions, adicione os secrets `NETLIFY_AUTH_TOKEN` e `NETLIFY_SITE_ID` no repositório GitHub (`.github/workflows/deploy.yml`).

## 3. Provedores no Firebase Console
- **Google Auth:** já ativo por padrão.
- **E-mail/Senha e Apple Auth:** ative em **Firebase Console → Authentication → Sign-in method** se desejar usá-los além do Google.
- **Domínios autorizados:** adicione o domínio do Netlify (ex.: `seu-site.netlify.app`) em **Authentication → Settings → Authorized domains**.
