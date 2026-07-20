# Manual do Usuário — Plataforma de Delivery

Este manual cobre **todas as funções do sistema**, organizadas por tipo de usuário:

1. [Para o dono da loja (Painel Admin)](#parte-1--painel-do-lojista)
2. [Para o cliente final (Cardápio e Pedidos)](#parte-2--experiência-do-cliente)
3. [Para o entregador (App do Motoboy)](#parte-3--app-do-motoboy)
4. [Mapa de endereços (URLs)](#mapa-de-urls)

---

## Parte 1 — Painel do Lojista

### 1.1 Criar sua loja

**Onde:** `/cadastrar`

O cadastro é gratuito e instantâneo — não precisa de aprovação.

1. Preencha o **nome da loja** (ex: "Shawarma da Nanda")
2. Escolha o **link do cardápio** (ex: `shawarma-da-nanda`). O sistema verifica na hora se o link está disponível (✓ verde = livre, ✗ vermelho = já em uso). Use só letras minúsculas, números e hífens, mínimo 3 caracteres.
3. Informe **seu nome**, **e-mail** e **senha**
4. Clique em **"Criar minha loja grátis"**

Você entra direto no painel, já logado, na tela de Configurações — comece por lá.

### 1.2 Entrar no painel

**Onde:** `/admin/login`

Informe e-mail e senha cadastrados. Por segurança, após **5 tentativas de login em 1 minuto**, o sistema bloqueia novas tentativas temporariamente — aguarde 1 minuto e tente de novo.

O menu lateral dá acesso a todos os módulos: **Pedidos, Chat, Dashboard, Clientes, Fidelização, Cardápio e Configurações**. No rodapé do menu ficam os botões **"Ativar notificações"** (avisos de pedido novo mesmo com a aba fechada) e **"Sair"**.

### 1.3 Configurações — deixe a loja com a sua cara

**Onde:** menu **Configurações**

É a primeira tela a preencher. Tudo que você salvar aqui aparece no cardápio público na hora.

**Status da loja (o botão mais importante)**
- Interruptor no topo: 🟢 **Aberta** (aceitando pedidos) / 🔴 **Fechada** (pedidos bloqueados)
- Com a loja fechada, o cliente vê o cardápio mas **não consegue finalizar pedido**
- Lembre de abrir ao começar o expediente e fechar ao encerrar — o sistema não faz isso sozinho

**Informações**
- **Nome da loja** — aparece no topo do cardápio
- **Link do cardápio** — o endereço que você divulga (ex: `/loja/shawarma-da-nanda`). ⚠️ Se mudar depois, os links antigos que você já compartilhou param de funcionar
- **Telefone/WhatsApp** — mostrado ao cliente (inclusive para envio de comprovante PIX)
- **Endereço** — exibido no cabeçalho do cardápio
- **Mensagem do topo** — um aviso em destaque (ex: "Frete grátis acima de R$ 50!")
- **Logo** e **Banner** — imagens enviadas do seu celular/computador. O banner pode ser **foto ou vídeo de até 10 segundos**
- **Cor principal** — pinta o cardápio inteiro com a cor da sua marca (seletor de cor ou código hex)

**Entrega**
- **Prazo médio (min)** — tempo estimado mostrado ao cliente (ex: 30 min)
- **Taxa de entrega (R$)** — valor único somado em todo pedido de entrega (retirada não paga taxa)
- **Pedido mínimo (R$)** — pedidos abaixo desse valor são recusados automaticamente

**Chave PIX**
- Escolha o tipo (CPF, CNPJ, e-mail, telefone ou aleatória) e cole a chave
- Quando o cliente escolher PIX no checkout, a chave aparece automaticamente para ele copiar e pagar. O pagamento é conferido por você, fora do sistema (peça o comprovante pelo WhatsApp)

**Agente de IA no Chat** *(seção roxa no final)*
- **Habilitar agente** — liga/desliga o atendente automático do chat
- **Nome do assistente** — como a IA se apresenta (ex: "Nanda")
- **Instrução extra** — personalize o comportamento (ex: "Sempre sugira o prato do dia. Use emojis.")
- **Delay da resposta** — segundos de "digitando..." antes de responder, para parecer natural
- A IA conhece seu cardápio, endereço e horários, e responde dúvidas dos clientes sozinha. Requer chave da Anthropic configurada no servidor.

Clique em **"Salvar configurações"** (e **"Salvar configurações de IA"** separadamente para a seção da IA).

### 1.4 Cardápio — monte seu catálogo

**Onde:** menu **Cardápio**

O cardápio é organizado em **Categorias → Produtos → Grupos de opção → Opções**.

**Categorias** (ex: Shawarmas, Bebidas, Sobremesas)
- Clique em **"Nova Categoria"**, dê um nome e salve
- Categorias podem ser editadas ou removidas (ícones no cabeçalho de cada uma)

**Produtos**
- Dentro de uma categoria, clique em **"Adicionar"** (ou no botão de novo produto)
- Campos:
  - **Nome** e **Descrição**
  - **Preço** e **Promo** (preço promocional — se preenchido, o cliente vê o preço riscado e paga o valor promocional)
  - **Foto** do produto
  - **Destaque** — produtos em destaque aparecem na vitrine "Oferta do Dia" no topo do cardápio
  - **Status**: `ativo` (à venda), `inativo` (escondido) ou `esgotado` (visível mas não compra)

**Grupos de opção** (personalizações do produto)
- Cada produto pode ter grupos como "Sabor", "Adicionais", "Tamanho"
- Configurações do grupo:
  - **Tipo único** — cliente escolhe apenas 1 (ex: sabor Carne OU Frango)
  - **Tipo múltiplo** — cliente marca várias (ex: adicionais)
  - **Obrigatório** — cliente não fecha o item sem escolher
  - **Mínimo / Máximo** — limite de escolhas (ex: escolha de 1 a 3 adicionais)
- Cada **opção** dentro do grupo tem nome e **preço adicional** (R$ 0,00 se for grátis — ex: sabor; R$ 3,00 para queijo extra)

> O sistema valida as regras dos grupos também no servidor: mesmo que alguém tente burlar pelo navegador, um pedido com combinação inválida é recusado.

### 1.5 Pedidos — o coração da operação

**Onde:** menu **Pedidos** (Kanban)

É a tela para deixar aberta o dia inteiro. Os pedidos entram **em tempo real** — quando chega um novo, toca um som 🔔, aparece um aviso e o card surge na primeira coluna sem você precisar atualizar a página.

**As 6 colunas (fluxo do pedido):**

| Coluna | Significado |
|---|---|
| **Recebidos** | Pedido acabou de chegar — confirme para o cliente saber que foi aceito |
| **Confirmados** | Aceito, aguardando a cozinha |
| **Em Produção** | Sendo preparado |
| **Prontos** | Pronto para entrega ou retirada |
| **Em Rota** | Saiu com o motoboy (só entrega) |
| **Entregues** | Finalizado |

**Como operar:**
- Botão **"Avançar"** no card → move o pedido para a próxima etapa com 1 clique
- Clique no card → abre os **detalhes completos**: itens com opções e observações, subtotal/taxa/total, forma de pagamento (e troco, se dinheiro), endereço de entrega com referência
- No detalhe também ficam os botões de cada status possível e o **"Cancelar pedido"**
- **Atribuir motoboy**: em pedidos de entrega, escolha o entregador no seletor dentro do detalhe do pedido

**Regras de status:** o sistema só permite transições válidas (ex: não dá para pular de "Recebido" direto para "Entregue"). Pedidos entregues ou cancelados não mudam mais.

**Importante:** o cliente acompanha tudo ao vivo — cada vez que você avança o status, a tela dele atualiza sozinha.

### 1.6 Chat — atendimento ao cliente

**Onde:** menu **Chat**

Caixa de entrada de todas as conversas iniciadas pelos clientes no cardápio.

- Lista de conversas com **contador de não lidas**
- Clique numa conversa para ver o histórico e **responder como atendente**
- Painel lateral mostra os **pedidos daquele cliente** para dar contexto
- Status da conversa: **Aberta → Em atendimento → Resolvida** (organize sua fila)
- Se o **Agente de IA** estiver habilitado (Configurações), ele responde automaticamente as mensagens dos clientes. Você pode entrar na conversa a qualquer momento e responder por cima
  - ⚠️ A IA continua respondendo mesmo com você na conversa — se quiser atender só você, desabilite a IA temporariamente nas Configurações

### 1.7 Dashboard — números do negócio

**Onde:** menu **Dashboard**

Relatórios com filtro de período:

- **Resumo**: total de pedidos, receita, ticket médio e cancelamentos
- **Receita por dia**: gráfico de evolução das vendas
- **Por forma de pagamento**: quanto entrou em dinheiro, cartão e PIX
- **Produtos mais vendidos**: ranking do cardápio
- **Mapa de calor de horários**: grade dia da semana × hora mostrando os picos de pedidos — use para planejar equipe e estoque

### 1.8 Clientes — sua base

**Onde:** menu **Clientes**

- Lista de todos que já pediram, com **busca por nome ou telefone**
- Por cliente: **total de pedidos, total gasto, ticket médio e data do último pedido**
- Clique para abrir o **histórico completo de pedidos** daquele cliente

### 1.9 Fidelização — faça o cliente voltar

**Onde:** menu **Fidelização** (4 abas)

**Aba Cashback**
- Defina o **% do valor do pedido** que volta como crédito para o cliente (ex: 5%)
- O crédito cai na "carteira" do cliente automaticamente **quando o pedido é marcado como Entregue**
- O cliente usa o saldo como **desconto no próximo checkout**

**Aba Selos** (cartão fidelidade digital)
- A cada pedido entregue, o cliente ganha **1 selo**
- Ao completar a **meta** (ex: 10 selos), ganha a recompensa: **desconto em R$** (creditado na carteira) ou **item grátis** (você entrega pessoalmente)

**Aba Clube VIP**
- Níveis **Bronze → Prata → Ouro** conforme o total gasto pelo cliente (você define os valores de corte)
- Clientes Prata/Ouro ganham **cashback extra** (% adicional que você configura)

**Aba Marketing** (mensagens automáticas)
- **Boas-vindas**: enviada após o primeiro pedido
- **Recompra**: enviada para quem não pede há X dias (você define quantos)
- **Aniversário**: enviada no aniversário do cliente
- Escreva a mensagem usando `{nome}` para personalizar (ex: "Oi {nome}! Sentimos sua falta 😢")
- As mensagens são enviadas automaticamente **pelo chat do sistema**, uma vez por dia (10h)

A tela também mostra estatísticas: clientes com carteira, saldo total emitido, recompensas de selos e campanhas ativas.

### 1.10 Usuários — cadastre sua equipe

**Onde:** menu **Usuários** (visível apenas para administradores)

É onde o dono da loja dá acesso aos funcionários, cada um com o seu perfil:

| Perfil | O que pode fazer |
|---|---|
| **Administrador** | Tudo: pedidos, cardápio, chat, relatórios, fidelização, configurações e esta tela de usuários |
| **Atendente** | Opera o dia a dia: pedidos, chat, cardápio e clientes — **sem** acesso a usuários, relatórios, fidelização e configurações |
| **Motoboy** | Usa apenas o app de entregas em `/motoboy` (lista de entregas + GPS) |

**Como cadastrar um funcionário:**
1. Clique em **"Novo usuário"**
2. Preencha **nome**, **e-mail** (será o login) e **senha** (mínimo 6 caracteres)
3. Escolha o **perfil de acesso** (Administrador, Atendente ou Motoboy)
4. Clique em **"Criar usuário"** — pronto, o funcionário já pode entrar em `/admin/login` (ou `/motoboy/login` se for motoboy)

**Editar/gerenciar:** o lápis ✏️ edita nome, perfil e senha (o e-mail de login não muda); a lixeira 🗑️ remove o acesso; também dá para **desativar** temporariamente um usuário sem excluí-lo.

**Proteções automáticas:** você não consegue remover ou rebaixar a própria conta, nem deixar a loja sem pelo menos um administrador ativo — o sistema bloqueia.

### 1.11 Ajuda dentro do painel

No menu lateral há o botão **Ajuda** (❓), que abre este manual completo dentro do próprio painel — organizado por módulo, para consulta rápida durante a operação. Compartilhe com cada funcionário novo.

### 1.12 Notificações no celular/computador

- No menu lateral, clique em **"Ativar notificações"** e aceite a permissão do navegador
- Você passa a receber um aviso de **novo pedido** mesmo com a aba do painel fechada
- Funciona também com o painel **instalado como aplicativo** (o navegador oferece "Instalar app" / "Adicionar à tela inicial")

---

## Parte 2 — Experiência do Cliente

*Esta parte explica o que o seu cliente vê — útil para você orientá-lo por WhatsApp.*

### 2.1 Navegar no cardápio

**Onde:** `/loja/SEU-LINK` (ex: `/loja/shawarma-da-nanda`)

- Topo: banner, nome, status (🟢 Aberto / 🔴 Fechado), prazo médio, taxa de entrega, endereço e mensagem da loja
- **Oferta do Dia**: vitrine com os produtos em destaque
- Categorias com todos os produtos, foto e preço (promoções aparecem com preço riscado)

### 2.2 Montar o pedido

1. Toque no produto → abre a janela de personalização
2. Escolha as **opções** (sabor, adicionais...) — os grupos obrigatórios precisam ser preenchidos
3. Escreva uma **observação** se quiser (ex: "sem cebola")
4. Escolha a **quantidade** e toque em **Adicionar**
5. O **carrinho** acumula os itens — dá para alterar quantidades ou remover

### 2.3 Finalizar (checkout)

1. **Entrega ou Retirada** — retirada não paga taxa de entrega
2. **Nome e telefone** (o sistema lembra nas próximas vezes)
3. Se entrega: **endereço completo** (rua, número, complemento, bairro, cidade, ponto de referência)
4. **Forma de pagamento:**
   - **Dinheiro** — informe "troco para quanto" (o sistema recusa valor menor que o total)
   - **Cartão de débito/crédito** — na maquininha, na entrega
   - **PIX** — a chave da loja aparece após confirmar; pague no app do banco e envie o comprovante no WhatsApp da loja
5. Se tiver **saldo na carteira** (cashback), pode ativar o uso como desconto
6. Confirmar — se o valor estiver abaixo do pedido mínimo, o sistema avisa

### 2.4 Acompanhar o pedido

Após confirmar, o cliente cai na **página de acompanhamento** (guarde/compartilhe esse link — ele contém um código de acesso exclusivo do pedido; sem ele ninguém abre o pedido).

- **Linha do tempo ao vivo**: Recebido → Confirmado → Em Produção → Pronto → (Saiu para Entrega) → Entregue — atualiza sozinha, sem recarregar a página
- Quando o pedido está **em rota**, aparece um **mapa com a posição do motoboy em tempo real** 🛵
- Detalhes completos: itens, valores, pagamento e endereço

### 2.5 Falar com a loja

- Botão flutuante **"Falar com atendente"** no cardápio
- Na primeira vez, informa **nome e telefone**
- Se a loja tiver IA habilitada, o assistente responde na hora sobre cardápio, preços e horários; um atendente humano pode assumir a conversa a qualquer momento

---

## Parte 3 — App do Motoboy

**Onde:** `/motoboy/login`

O entregador faz login com e-mail e senha de uma conta com perfil **motoboy** — criada pelo administrador da loja no menu **Usuários** (ver seção 1.10).

**Fluxo de trabalho do entregador:**

1. Após o login, aparece a **lista de entregas pendentes** — apenas os pedidos que o lojista atribuiu a ele, nos status "Aguardando retirada" (pronto) e "Em entrega"
2. Toque num pedido para ver o **endereço completo**, itens e valor
3. **"Iniciar rastreamento"** — liga o GPS do celular; a posição passa a aparecer **ao vivo no mapa do cliente**. Só o motoboy realmente atribuído ao pedido consegue transmitir posição (proteção do sistema)
4. **"Pausar GPS"** — interrompe a transmissão (ex: parada para outro pedido)
5. **"Entregue!"** — marca o pedido como entregue. Isso também dispara o cashback/selo do cliente
6. **"Atualizar lista"** — recarrega as entregas pendentes

O app do motoboy só acessa as rotas do entregador — não tem acesso ao painel administrativo (e vice-versa: o admin não acessa as rotas do motoboy).

---

## Mapa de URLs

| Endereço | O que é | Quem usa |
|---|---|---|
| `/cadastrar` | Criar loja nova | Futuro lojista |
| `/loja/SEU-LINK` | Cardápio público | Cliente |
| `/loja/SEU-LINK/checkout` | Finalizar pedido | Cliente |
| `/loja/SEU-LINK/pedido/ID?token=...` | Acompanhar pedido (link com código de acesso) | Cliente |
| `/admin/login` | Entrar no painel | Lojista |
| `/admin/pedidos` | Kanban de pedidos | Lojista |
| `/admin/cardapio` | Gerenciar cardápio | Lojista |
| `/admin/chat` | Atendimento | Lojista |
| `/admin/dashboard` | Relatórios | Lojista |
| `/admin/clientes` | Base de clientes | Lojista |
| `/admin/fidelizacao` | Cashback, selos, VIP, marketing | Lojista |
| `/admin/usuarios` | Cadastrar equipe e perfis de acesso | Lojista (admin) |
| `/admin/ajuda` | Este manual dentro do painel | Lojista |
| `/admin/configuracoes` | Dados da loja, entrega, PIX, IA | Lojista |
| `/motoboy/login` | Entrar no app do entregador | Motoboy |
| `/motoboy` | Entregas e GPS | Motoboy |

---

## Perguntas frequentes

**O pedido não está chegando no painel — o que fazer?**
Confira se a tela de Pedidos está aberta e conectada (os pedidos chegam em tempo real). Como reserva, o botão de recarregar (↻) busca os pedidos manualmente.

**O cliente diz que não consegue pedir.**
Verifique: (1) a loja está 🟢 Aberta nas Configurações? (2) o pedido dele atinge o pedido mínimo? (3) o produto está `ativo` e a categoria ativa?

**Como recebo o dinheiro do PIX?**
Direto na sua conta — o sistema apenas mostra sua chave ao cliente. Confira o comprovante antes de confirmar o pedido.

**Posso mudar o link da loja?**
Pode (Configurações → Link do cardápio), mas os links antigos já divulgados deixam de funcionar. Evite mudar depois de imprimir materiais.

**O que acontece se eu marcar "Entregue"?**
O pedido finaliza, o cliente é notificado, e a fidelização processa: cashback creditado + 1 selo no cartão do cliente.

**Como cadastro um motoboy ou atendente?**
Menu **Usuários** → "Novo usuário" → escolha o perfil. O funcionário entra com o e-mail e senha que você definir (motoboys entram em `/motoboy/login`).
