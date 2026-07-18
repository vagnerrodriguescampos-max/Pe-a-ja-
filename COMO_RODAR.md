# Como rodar o projeto

## Pré-requisitos
- Docker Desktop instalado e rodando
- Node.js 20+ (para desenvolvimento local)

---

## 🐳 Produção com Docker (recomendado)

```bash
cd shawarma-da-nanda

# Copiar .env
cp .env.example .env

# IMPORTANTE: edite o .env e preencha as variáveis obrigatórias:
#   JWT_SECRET    — mínimo de 32 caracteres aleatórios (gere com: openssl rand -base64 48)
#   CORS_ORIGINS  — origens do frontend separadas por vírgula (ex: http://localhost:3000)
# Sem elas o backend não inicia.

# Subir tudo
docker-compose up --build -d

# Rodar migrations (a imagem de produção não tem ts-node, use a variante :prod)
docker-compose exec backend npm run migration:run:prod

# Rodar seed (dados iniciais + loja de exemplo)
docker-compose exec backend npm run seed:prod
```

Acesse (slug e credenciais definidos em `backend/src/database/seeds/seed.ts`):
- **Cardápio:** http://localhost:3000/loja/eu-pedi
- **Admin:** http://localhost:3000/admin/login
  - Email: `admin@eupedi.com`
  - Senha: `admin123`
- **API:** http://localhost:3001

---

## 💻 Desenvolvimento local

### Backend
```bash
cd backend
npm install

# Criar .env com sua string de banco
# (o docker-compose expõe o postgres na porta 5433 do host)
echo "DATABASE_URL=postgresql://delivery_user:delivery_pass@localhost:5433/delivery_db" > .env
# JWT_SECRET precisa ter no mínimo 32 caracteres (gere o seu com: openssl rand -base64 48)
echo "JWT_SECRET=troque_este_valor_por_um_segredo_aleatorio_de_dev_32+" >> .env

# Subir só o postgres
docker-compose up postgres -d

# Rodar migrations e seed
npm run migration:run
npm run seed

# Iniciar backend
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install

# .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:3001" >> .env.local

npm run dev
```

---

## ✅ Testes

```bash
cd backend
npm test
```

---

## 🗺️ Estrutura das URLs

| URL | Descrição |
|-----|-----------|
| `/loja/:slug` | Cardápio público |
| `/loja/:slug/checkout` | Checkout do pedido |
| `/loja/:slug/pedido/:id` | Acompanhamento em tempo real |
| `/admin/login` | Login do painel |
| `/admin/pedidos` | Kanban de pedidos |
| `/admin/cardapio` | Gerenciar cardápio |
| `/admin/configuracoes` | Configurações da loja |

---

## 📡 Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/auth/login` | Login admin |
| `GET` | `/loja/:slug` | Dados da loja |
| `GET` | `/loja/:slug/cardapio` | Cardápio completo |
| `GET` | `/loja/:slug/produto/:id` | Produto com opções |
| `POST` | `/loja/:slug/pedidos` | Criar pedido |
| `GET` | `/pedidos/:id` | Acompanhar pedido |
| `GET` | `/admin/pedidos` | Listar pedidos (auth) |
| `PATCH` | `/admin/pedidos/:id/status` | Atualizar status (auth) |
| `GET` | `/admin/loja` | Dados da loja (auth) |
| `PATCH` | `/admin/loja` | Atualizar loja (auth) |

---

## WebSocket eventos

| Evento (emit) | Descrição |
|--------------|-----------|
| `entrar_pedido` | Cliente monitora pedido específico |
| `entrar_loja` | Admin monitora todos os pedidos |

| Evento (on) | Descrição |
|------------|-----------|
| `pedido:novo` | Novo pedido chegou (admin) |
| `pedido:status_changed` | Status atualizado (cliente + admin) |
