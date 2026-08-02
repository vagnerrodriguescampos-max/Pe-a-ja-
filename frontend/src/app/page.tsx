import Link from 'next/link';
import { ArrowRight, Zap, Navigation, Gift, BadgePercent, Star } from 'lucide-react';

export const metadata = {
  title: 'Peça Já — O delivery da sua loja, sem comissão',
  description: 'Cardápio digital, pedidos em tempo real, rastreamento do entregador e fidelização. Tudo no seu link, com a sua marca. Sem taxa por pedido.',
};

const features = [
  { icon: Zap, title: 'Pedidos em tempo real', desc: 'Cai na tela na hora, com som e painel Kanban. Nada de recarregar.' },
  { icon: Navigation, title: 'Rastreamento ao vivo', desc: 'O cliente acompanha o motoboy no mapa, em tempo real.' },
  { icon: Gift, title: 'Fidelização automática', desc: 'Cashback, selos e clube VIP que trazem o cliente de volta.' },
  { icon: BadgePercent, title: '0% de comissão', desc: 'Você não paga taxa por pedido. O lucro inteiro é seu.' },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0b09] text-white">
      {/* glows de fundo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="lp-glow absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(255,90,60,.45), transparent 65%)' }} />
        <div className="lp-glow absolute top-20 -right-40 h-[32rem] w-[32rem] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(255,160,50,.32), transparent 65%)', animationDelay: '2s' }} />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      </div>

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="lp-reveal flex items-center gap-2 font-bold text-lg">
          <span className="text-2xl">🍕</span> Peça Já
        </div>
        <Link href="/admin/login"
          className="lp-reveal rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/10">
          Entrar
        </Link>
      </header>

      {/* hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-10 py-10 md:grid-cols-2 md:py-20">
          {/* texto */}
          <div>
            <span className="lp-reveal lp-d1 inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-300">
              <Star size={12} fill="currentColor" /> Plataforma de delivery própria
            </span>
            <h1 className="lp-reveal lp-d2 mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
              O delivery da sua loja,<br /><span className="lp-gradient-text">sem comissão.</span>
            </h1>
            <p className="lp-reveal lp-d3 mt-5 max-w-md text-base leading-relaxed text-white/60">
              Cardápio digital, pedidos em tempo real, rastreamento do entregador e fidelização —
              tudo no <strong className="text-white/80">seu link</strong>, com a <strong className="text-white/80">sua marca</strong>.
              Sem taxa por pedido.
            </p>
            <div className="lp-reveal lp-d4 mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastrar"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:shadow-red-500/40 hover:brightness-110 active:scale-95">
                Criar minha loja grátis
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/loja/peca-ja"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-sm font-semibold text-white/90 backdrop-blur transition-colors hover:bg-white/10">
                Ver demonstração
              </Link>
            </div>
            <p className="lp-reveal lp-d5 mt-4 text-xs text-white/40">
              Grátis para começar · Sem cartão de crédito
            </p>
          </div>

          {/* visual */}
          <div className="lp-reveal lp-d3 relative mx-auto w-full max-w-md">
            <div className="lp-float relative overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/60">
              <img src="/landing/hero.jpg" alt="Pizza artesanal" className="h-[24rem] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* chip: novo pedido */}
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs backdrop-blur-md">
                <span className="lp-dot h-2 w-2 rounded-full bg-green-400" />
                <span className="font-semibold">Novo pedido</span>
                <span className="text-white/60">#128 · R$ 74,90</span>
              </div>
            </div>
            {/* card flutuante secundário */}
            <div className="lp-float2 absolute -bottom-6 -left-6 hidden w-40 overflow-hidden rounded-2xl border border-white/10 shadow-xl shadow-black/50 sm:block">
              <img src="/landing/pizza.jpg" alt="Pizza" className="h-28 w-full object-cover" />
            </div>
            {/* chip: entregue */}
            <div className="lp-float2 absolute -right-3 bottom-10 flex items-center gap-2 rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs backdrop-blur-md">
              <Navigation size={13} className="text-orange-300" />
              <span className="font-semibold">Motoboy a caminho</span>
            </div>
          </div>
        </div>

        {/* features */}
        <div className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-4 md:pb-24">
          {features.map((f, i) => (
            <div key={f.title}
              className={`lp-reveal lp-d${i + 3} group rounded-2xl border border-white/10 bg-white/[.03] p-5 transition-all hover:-translate-y-1 hover:border-orange-400/30 hover:bg-white/[.06]`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-300">
                <f.icon size={20} />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* footer */}
      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm text-white/40 sm:flex-row">
          <span className="flex items-center gap-2"><span className="text-lg">🍕</span> Peça Já — seu delivery, sua marca.</span>
          <div className="flex gap-5">
            <Link href="/cadastrar" className="transition-colors hover:text-white/70">Criar loja</Link>
            <Link href="/admin/login" className="transition-colors hover:text-white/70">Entrar</Link>
            <Link href="/loja/peca-ja" className="transition-colors hover:text-white/70">Demonstração</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
