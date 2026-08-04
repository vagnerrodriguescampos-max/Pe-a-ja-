'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { HelpCircle, Store, UtensilsCrossed, LayoutGrid, MessageSquare, BarChart2, Users, Gift, UserCog, Bike, Smartphone, ShoppingBag, CheckCircle2, XCircle, AlertTriangle, Bell, ChevronRight } from 'lucide-react';

const SECOES: { icon: any; titulo: string; conteudo: React.ReactNode }[] = [
  {
    icon: Store,
    titulo: 'Configurações — deixe a loja com a sua cara',
    conteudo: (
      <>
        <p><strong>Status da loja (o botão mais importante):</strong> o interruptor <CheckCircle2 className="inline w-4 h-4 text-green-500 align-text-bottom" /> Aberta / <XCircle className="inline w-4 h-4 text-red-500 align-text-bottom" /> Fechada controla se os clientes conseguem finalizar pedidos. Lembre de abrir ao começar o expediente e fechar ao encerrar — o sistema não faz isso sozinho.</p>
        <p><strong>Informações:</strong> nome, link do cardápio (<AlertTriangle className="inline w-3.5 h-3.5 text-amber-500 align-text-bottom" /> mudar o link quebra os já compartilhados), telefone/WhatsApp, endereço, mensagem do topo, logo, banner (foto ou vídeo de até 10s) e a cor principal que pinta o cardápio inteiro.</p>
        <p><strong>Entrega:</strong> prazo médio (min), taxa de entrega única (retirada não paga) e pedido mínimo — pedidos abaixo são recusados automaticamente.</p>
        <p><strong>Chave PIX:</strong> escolha o tipo e cole a chave. Ela aparece automaticamente para clientes que escolherem PIX. O pagamento é conferido por você fora do sistema (peça o comprovante pelo WhatsApp).</p>
        <p><strong>Agente de IA no chat:</strong> habilite, dê um nome, escreva instruções extras e defina o delay do &quot;digitando...&quot;. A IA conhece seu cardápio e responde clientes sozinha.</p>
      </>
    ),
  },
  {
    icon: UtensilsCrossed,
    titulo: 'Cardápio — monte seu catálogo',
    conteudo: (
      <>
        <p>Organizado em <strong>Categorias → Produtos → Grupos de opção → Opções</strong>.</p>
        <p><strong>Produto:</strong> nome, descrição, preço, preço promocional (aparece riscado), foto, destaque (vitrine &quot;Oferta do Dia&quot;) e status: <em>ativo</em> (à venda), <em>inativo</em> (escondido) ou <em>esgotado</em> (visível sem comprar).</p>
        <p><strong>Grupos de opção</strong> (ex.: Sabor, Adicionais): tipo <em>único</em> (escolhe 1) ou <em>múltiplo</em> (marca várias), obrigatório ou não, e limites mínimo/máximo. Cada opção pode ter preço adicional (R$ 0 se grátis).</p>
        <p>O servidor revalida todas as regras na hora do pedido — não dá para burlar pelo navegador.</p>
      </>
    ),
  },
  {
    icon: LayoutGrid,
    titulo: 'Pedidos (Kanban) — o coração da operação',
    conteudo: (
      <>
        <p>Deixe esta tela aberta o dia inteiro: pedidos novos chegam <strong>em tempo real</strong>, com som <Bell className="inline w-4 h-4 text-gray-500 align-text-bottom" /> e aviso, sem atualizar a página.</p>
        <p><strong>Fluxo:</strong> Recebidos → Confirmados → Em Produção → Prontos → Em Rota → Entregues. O botão <strong>Avançar</strong> move para a próxima etapa com 1 clique.</p>
        <p>Clique no card para ver <strong>detalhes completos</strong> (itens, observações, endereço, pagamento e troco), <strong>atribuir motoboy</strong> (pedidos de entrega) e <strong>cancelar</strong>.</p>
        <p>O sistema só permite transições válidas — não dá para pular etapas. O cliente acompanha tudo ao vivo: cada avanço atualiza a tela dele sozinho.</p>
      </>
    ),
  },
  {
    icon: MessageSquare,
    titulo: 'Chat — atendimento ao cliente',
    conteudo: (
      <>
        <p>Caixa de entrada das conversas iniciadas no cardápio, com contador de não lidas. Clique para ver o histórico e responder; o painel lateral mostra os pedidos daquele cliente.</p>
        <p>Organize a fila com os status <strong>Aberta → Em atendimento → Resolvida</strong>.</p>
        <p>Se o Agente de IA estiver habilitado, ele responde sozinho — e continua respondendo mesmo com você na conversa. Para atender só você, desabilite a IA temporariamente nas Configurações.</p>
      </>
    ),
  },
  {
    icon: BarChart2,
    titulo: 'Dashboard — números do negócio',
    conteudo: (
      <>
        <p><strong>Resumo</strong> (pedidos, receita, ticket médio, cancelamentos), <strong>receita por dia</strong>, <strong>formas de pagamento</strong>, <strong>produtos mais vendidos</strong> e o <strong>mapa de calor de horários</strong> (dia × hora) para planejar equipe e estoque.</p>
      </>
    ),
  },
  {
    icon: Users,
    titulo: 'Clientes — sua base',
    conteudo: (
      <>
        <p>Todos que já pediram, com busca por nome ou telefone. Por cliente: total de pedidos, total gasto, ticket médio e último pedido. Clique para abrir o histórico completo.</p>
      </>
    ),
  },
  {
    icon: Gift,
    titulo: 'Fidelização — faça o cliente voltar',
    conteudo: (
      <>
        <p><strong>Cashback:</strong> % do pedido volta como crédito na carteira quando o pedido é marcado Entregue; o cliente usa como desconto no próximo checkout.</p>
        <p><strong>Selos:</strong> 1 selo por pedido entregue; ao bater a meta, ganha desconto em R$ (na carteira) ou item grátis.</p>
        <p><strong>Clube VIP:</strong> níveis Bronze → Prata → Ouro por gasto acumulado, com cashback extra para Prata/Ouro.</p>
        <p><strong>Marketing automático:</strong> mensagens de boas-vindas, recompra (sumido há X dias) e aniversário — escreva usando <code>{'{nome}'}</code> para personalizar. Enviadas pelo chat, uma vez por dia (10h).</p>
      </>
    ),
  },
  {
    icon: UserCog,
    titulo: 'Usuários — cadastre sua equipe',
    conteudo: (
      <>
        <p>Somente administradores veem esta tela. Clique em <strong>Novo usuário</strong>, preencha nome, e-mail (login) e senha, e escolha o perfil:</p>
        <p><strong>Administrador</strong> — acessa tudo. <strong>Atendente</strong> — pedidos, chat, cardápio e clientes (sem usuários/relatórios/configurações). <strong>Motoboy</strong> — apenas o app de entregas em <code>/motoboy</code>.</p>
        <p>O lápis edita nome/perfil/senha; a lixeira remove; também dá para desativar sem excluir. O sistema impede remover a própria conta ou deixar a loja sem administrador.</p>
      </>
    ),
  },
  {
    icon: Bike,
    titulo: 'App do Motoboy',
    conteudo: (
      <>
        <p>O entregador entra em <code>/motoboy/login</code> com a conta criada no menu Usuários. Ele vê as entregas atribuídas a ele, toca num pedido, e:</p>
        <p><strong>Iniciar rastreamento</strong> liga o GPS — a posição aparece ao vivo no mapa do cliente. <strong>Pausar GPS</strong> interrompe. <strong>Entregue!</strong> finaliza o pedido (e dispara o cashback/selo do cliente).</p>
      </>
    ),
  },
  {
    icon: ShoppingBag,
    titulo: 'O que o seu cliente vê',
    conteudo: (
      <>
        <p><strong>Cardápio</strong> → toca no produto → escolhe opções/observação → <strong>carrinho</strong> → <strong>checkout</strong>: entrega ou retirada, nome/telefone, endereço (se entrega), pagamento (dinheiro com troco validado, cartão na maquininha, ou PIX com a chave exibida) e uso do saldo da carteira.</p>
        <p>Após confirmar, cai na <strong>página de acompanhamento</strong> (link com código de acesso exclusivo — sem ele ninguém abre o pedido): linha do tempo ao vivo e, quando em rota, o <strong>mapa do motoboy em tempo real</strong>.</p>
        <p>O botão <strong>Falar com atendente</strong> abre o chat (com IA, se habilitada).</p>
      </>
    ),
  },
  {
    icon: Smartphone,
    titulo: 'Instalar como aplicativo + notificações',
    conteudo: (
      <>
        <p>No menu lateral: <strong>Instalar app</strong> (quando o navegador oferecer) coloca o painel na tela inicial do celular/PC; <strong>Ativar notificações</strong> faz você receber aviso de novo pedido mesmo com a aba fechada.</p>
      </>
    ),
  },
];

export default function AjudaPage() {
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-page-title text-gray-900 flex items-center gap-2">
            <HelpCircle size={22} /> Ajuda — Manual do sistema
          </h1>
          <p className="text-caption text-gray-400 mt-0.5">
            Guia completo de cada módulo. Toque numa seção para abrir.
          </p>
        </div>

        <div className="space-y-2">
          {SECOES.map(({ icon: Icon, titulo, conteudo }) => (
            <details key={titulo} className="card overflow-hidden group">
              <summary className="flex items-center gap-3 p-4 cursor-pointer select-none hover:bg-gray-50 transition-colors">
                <span className="w-9 h-9 rounded-full bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center flex-shrink-0">
                  <Icon size={17} />
                </span>
                <span className="font-semibold text-gray-800 text-sm flex-1">{titulo}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 pl-16 text-sm text-gray-600 space-y-2 leading-relaxed [&_strong]:text-gray-800 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded">
                {conteudo}
              </div>
            </details>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-8 text-center">
          Dica: cadastre cada funcionário no menu <strong>Usuários</strong> e mostre esta página no primeiro dia.
        </p>
      </div>
    </AdminLayout>
  );
}
