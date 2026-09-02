const ESTOQUE360_TABS = [
  ["cockpit", "Cockpit"],
  ["ruptura", "Ruptura"],
  ["cobertura", "Cobertura"],
  ["excesso", "Excesso"],
  ["abastecimento", "Abastecimento"],
  ["transferencias", "Transferências"],
  ["plano-acao", "Plano de Ação"],
];

const DEFAULT_ENDPOINTS = {
  resumo: "/api/estoque/resumo",
  ruptura: "/api/estoque/ruptura",
  cobertura: "/api/estoque/cobertura",
  excesso: "/api/estoque/excesso",
  abastecimento: "/api/estoque/abastecimento",
  transferencias: "/api/estoque/transferencias",
  "plano-acao": "/api/estoque/plano-acao",
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtData(v) {
  if (!v) return "—";
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString("pt-BR");
}

function fmtMoney(v) { return Number.isFinite(Number(v)) ? money.format(Number(v)) : "—"; }
function fmtNum(v) { return Number.isFinite(Number(v)) ? num.format(Number(v)) : "—"; }
function fmtInt(v) { return Number.isFinite(Number(v)) ? inteiro.format(Number(v)) : "—"; }
function fmtPct(v) { return Number.isFinite(Number(v)) ? `${num.format(Number(v))}%` : "—"; }

class ChartRegistry {
  constructor() { this.items = new Map(); }

  set(root, id, option) {
    if (!window.echarts) return false;
    const dom = root.querySelector(`#${CSS.escape(id)}`);
    if (!dom || !dom.isConnected) return false;

    const anterior = this.items.get(id);
    if (anterior && anterior.dom !== dom) {
      try { anterior.chart.dispose(); } catch (_) {}
      this.items.delete(id);
    }

    let chart = window.echarts.getInstanceByDom(dom);
    if (!chart) chart = window.echarts.init(dom);
    chart.setOption(option, { notMerge: true, lazyUpdate: false });
    this.items.set(id, { dom, chart });
    requestAnimationFrame(() => {
      if (dom.isConnected) {
        try { chart.resize(); } catch (_) {}
      }
    });
    return true;
  }

  resize() {
    for (const { dom, chart } of this.items.values()) {
      if (dom.isConnected) {
        try { chart.resize(); } catch (_) {}
      }
    }
  }

  cleanup(root) {
    for (const [id, item] of this.items.entries()) {
      if (!item.dom.isConnected || !root.contains(item.dom)) {
        try { item.chart.dispose(); } catch (_) {}
        this.items.delete(id);
      }
    }
  }

  dispose() {
    for (const { chart } of this.items.values()) {
      try { chart.dispose(); } catch (_) {}
    }
    this.items.clear();
  }
}

async function defaultPost(url, body, signal) {
  const resp = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${url}`);
  return resp.json();
}

export class Estoque360App {
  constructor(root, options = {}) {
    if (!root) throw new Error("Container do Estoque 360 não informado");
    this.root = root;
    this.options = options;
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...(options.endpoints || {}) };
    this.post = options.post || defaultPost;
    this.tab = "cockpit";
    this.filtros = {};
    this.requestSeq = 0;
    this.controller = null;
    this.charts = new ChartRegistry();
    this.destroyed = false;
    this._resize = () => this.charts.resize();
    window.addEventListener("resize", this._resize, { passive: true });
    this.renderShell();
  }

  renderShell() {
    this.root.classList.add("estoque360");
    this.root.innerHTML = `
      <section class="e360-header">
        <div>
          <div class="e360-eyebrow">GESTÃO DE ESTOQUE & ABASTECIMENTO</div>
          <h2>Estoque 360</h2>
          <div class="e360-subtitle">Ruptura, cobertura, excesso, abastecimento e plano de ação na mesma posição de dados.</div>
        </div>
        <div class="e360-posicao" data-e360-posicao>Posição: —</div>
      </section>
      <nav class="e360-tabs" aria-label="Visões do Estoque 360">
        ${ESTOQUE360_TABS.map(([id, label]) => `<button type="button" data-e360-tab="${id}" class="${id === this.tab ? "ativo" : ""}">${label}</button>`).join("")}
      </nav>
      <section class="e360-content" data-e360-content></section>
    `;

    this.root.querySelectorAll("[data-e360-tab]").forEach((btn) => {
      btn.addEventListener("click", () => this.setTab(btn.dataset.e360Tab));
    });
  }

  async start(filtrosIniciais = {}) {
    this.filtros = { ...(filtrosIniciais || {}) };
    await this.refresh();
    return this;
  }

  async setGlobalFilters(filtros = {}) {
    this.filtros = { ...(filtros || {}) };
    await this.refresh();
  }

  async setTab(tab) {
    if (!ESTOQUE360_TABS.some(([id]) => id === tab) || tab === this.tab) return;
    this.tab = tab;
    this.root.querySelectorAll("[data-e360-tab]").forEach((btn) => {
      btn.classList.toggle("ativo", btn.dataset.e360Tab === tab);
    });
    await this.refresh();
  }

  payload(extra = {}) {
    const base = { ...(this.filtros || {}) };
    delete base.periodo_inicio;
    delete base.periodo_fim;
    return { ...base, ...extra };
  }

  contextoIA(dataPosicao) {
    const detail = {
      modulo: "ESTOQUE_360",
      subaba: this.tab,
      data_posicao: dataPosicao || null,
      filtros: { ...(this.filtros || {}) },
    };
    this.root.dispatchEvent(new CustomEvent("estoque360:contexto", { bubbles: true, detail }));
    if (typeof this.options.onContextChange === "function") this.options.onContextChange(detail);
  }

  setLoading() {
    const content = this.root.querySelector("[data-e360-content]");
    if (content) content.innerHTML = `<div class="e360-state"><span class="e360-spinner"></span> Atualizando indicadores…</div>`;
  }

  setError(err) {
    const content = this.root.querySelector("[data-e360-content]");
    if (content) content.innerHTML = `<div class="e360-state e360-error"><strong>Não foi possível carregar esta visão.</strong><br>${esc(err?.message || err)}</div>`;
  }

  async request(nome, extra = {}, signal) {
    const url = this.endpoints[nome];
    if (!url) throw new Error(`Endpoint não configurado: ${nome}`);
    return this.post(url, this.payload(extra), signal);
  }

  async refresh() {
    if (this.destroyed) return;
    const seq = ++this.requestSeq;
    if (this.controller) this.controller.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.setLoading();

    try {
      let result;
      if (this.tab === "cockpit") {
        const [resumo, cobertura] = await Promise.all([
          this.request("resumo", {}, signal),
          this.request("cobertura", {}, signal),
        ]);
        result = { resumo, cobertura };
      } else if (this.tab === "ruptura") {
        result = await this.request("ruptura", { dimensao: "loja", limite: 60 }, signal);
      } else if (this.tab === "cobertura") {
        result = await this.request("cobertura", {}, signal);
      } else if (this.tab === "excesso") {
        result = await this.request("excesso", { limite: 250 }, signal);
      } else if (this.tab === "abastecimento") {
        result = await this.request("abastecimento", { limite: 250 }, signal);
      } else if (this.tab === "transferencias") {
        result = await this.request("transferencias", { limite: 250 }, signal);
      } else {
        result = await this.request("plano-acao", { limite: 400 }, signal);
      }

      if (seq !== this.requestSeq || signal.aborted || this.destroyed) return;
      this.renderResult(result);
    } catch (err) {
      if (err?.name === "AbortError" || seq !== this.requestSeq || this.destroyed) return;
      this.setError(err);
    }
  }

  renderResult(result) {
    this.charts.cleanup(this.root);
    if (this.tab === "cockpit") return this.renderCockpit(result.resumo, result.cobertura);
    if (result?.sem_acesso) return this.renderSemAcesso();
    const posicao = result?.data_posicao || result?.posicao?.data_posicao;
    this.updatePosicao(posicao);
    this.contextoIA(posicao);
    if (this.tab === "ruptura") return this.renderRuptura(result.dados || []);
    if (this.tab === "cobertura") return this.renderCobertura(result.dados || []);
    if (this.tab === "excesso") return this.renderExcesso(result.dados || []);
    if (this.tab === "abastecimento") return this.renderAbastecimento(result.dados || []);
    if (this.tab === "transferencias") return this.renderTransferencias(result.dados || []);
    return this.renderPlano(result.dados || []);
  }

  updatePosicao(posicao) {
    const el = this.root.querySelector("[data-e360-posicao]");
    if (el) el.textContent = `Posição: ${fmtData(posicao)}`;
  }

  renderSemAcesso() {
    this.updatePosicao(null);
    this.root.querySelector("[data-e360-content]").innerHTML = `<div class="e360-state">Seu usuário não possui lojas liberadas para esta consulta.</div>`;
  }

  renderCockpit(resumoResp, coberturaResp) {
    if (resumoResp?.sem_acesso) return this.renderSemAcesso();
    const d = resumoResp?.dados || {};
    const posicao = resumoResp?.data_posicao || d.data_posicao;
    this.updatePosicao(posicao);
    this.contextoIA(posicao);
    const content = this.root.querySelector("[data-e360-content]");
    const cards = [
      ["Estoque disponível", fmtMoney(d.estoque_valor)],
      ["DDV atual", `${fmtNum(d.ddv_atual)} dias`],
      ["DDV projetado", `${fmtNum(d.ddv_projetado)} dias`],
      ["Ruptura", fmtPct(d.ruptura_pct)],
      ["Ruptura sem pedido", fmtInt(d.ruptura_sem_pedido)],
      ["Ruptura com pedido", fmtInt(d.ruptura_com_pedido)],
      ["Carteira", fmtMoney(d.carteira_valor)],
      ["Capital excedente", fmtMoney(d.capital_excedente_estimado)],
      ["Estoque sem venda", fmtMoney(d.estoque_sem_venda_valor)],
    ];
    content.innerHTML = `
      <div class="e360-kpis">${cards.map(([l, v]) => `<article class="e360-kpi"><span>${esc(l)}</span><strong>${esc(v)}</strong></article>`).join("")}</div>
      <div class="e360-grid2">
        <article class="e360-panel"><header><h3>Distribuição da cobertura</h3><span>Itens por faixa de DDV</span></header><div id="e360-chart-cobertura" class="e360-chart"></div></article>
        <article class="e360-panel"><header><h3>Leitura executiva</h3><span>Atual x projetado</span></header>
          <div class="e360-ddv-compare"><div><small>Atual</small><strong>${fmtNum(d.ddv_atual)}</strong><span>dias</span></div><div class="e360-arrow">→</div><div><small>Projetado</small><strong>${fmtNum(d.ddv_projetado)}</strong><span>dias</span></div></div>
          <div class="e360-note">Meta de referência atual: ${fmtNum(d.ddv_alvo)} dias. A posição projetada incorpora estoque, trânsito, pedido pendente e carteira.</div>
        </article>
      </div>`;
    this.chartCobertura(coberturaResp?.dados || []);
  }

  chartCobertura(rows) {
    const labels = rows.map((r) => r.faixa);
    const vals = rows.map((r) => Number(r.itens || 0));
    const ok = this.charts.set(this.root, "e360-chart-cobertura", {
      tooltip: { trigger: "axis" },
      grid: { left: 42, right: 18, top: 25, bottom: 42 },
      xAxis: { type: "category", data: labels, axisLabel: { interval: 0, rotate: 25 } },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: vals, barMaxWidth: 44 }],
    });
    if (!ok) this.fallbackChart("e360-chart-cobertura", rows.map((r) => `${r.faixa}: ${fmtInt(r.itens)}`));
  }

  fallbackChart(id, linhas) {
    const el = this.root.querySelector(`#${CSS.escape(id)}`);
    if (el) el.innerHTML = `<div class="e360-chart-fallback">${linhas.map((x) => `<span>${esc(x)}</span>`).join("")}</div>`;
  }

  renderRuptura(rows) {
    const content = this.root.querySelector("[data-e360-content]");
    content.innerHTML = `<div class="e360-grid2"><article class="e360-panel"><header><h3>Ruptura por loja</h3><span>Percentual e tratamento do pedido</span></header><div id="e360-chart-ruptura" class="e360-chart e360-chart-lg"></div></article><article class="e360-panel e360-table-panel">${this.table(["Loja","Ruptura %","Itens","Sem pedido","Com pedido"], rows, (r) => [r.dimensao, fmtPct(r.ruptura_pct), fmtInt(r.ruptura), fmtInt(r.sem_pedido), fmtInt(r.com_pedido)])}</article></div>`;
    const top = rows.slice(0, 20);
    const ok = this.charts.set(this.root, "e360-chart-ruptura", {
      tooltip: { trigger: "axis" }, grid: { left: 115, right: 25, top: 15, bottom: 25 },
      xAxis: { type: "value" }, yAxis: { type: "category", inverse: true, data: top.map((r) => r.dimensao) },
      series: [{ type: "bar", data: top.map((r) => Number(r.ruptura_pct || 0)), barMaxWidth: 24 }],
    });
    if (!ok) this.fallbackChart("e360-chart-ruptura", top.map((r) => `${r.dimensao}: ${fmtPct(r.ruptura_pct)}`));
  }

  renderCobertura(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = `<article class="e360-panel"><header><h3>Faixas de cobertura</h3><span>Quantidade de itens e capital por faixa</span></header><div id="e360-chart-cobertura" class="e360-chart e360-chart-lg"></div>${this.table(["Faixa","Itens","Estoque R$"], rows, (r) => [r.faixa, fmtInt(r.itens), fmtMoney(r.estoque_valor)])}</article>`;
    this.chartCobertura(rows);
  }

  renderExcesso(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = `<article class="e360-panel e360-table-panel"><header><h3>Excesso de estoque</h3><span>Ordenado pelo capital excedente estimado</span></header>${this.table(["Loja","SKU","Produto","Curva","DDV","Estoque R$","Excesso R$"], rows, (r) => [r.loja, r.sku, r.descricao, r.curva_abc, fmtNum(r.ddv_atual_31d), fmtMoney(r.estoque_disponivel_valor), fmtMoney(r.excesso_valor)])}</article>`;
  }

  renderAbastecimento(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = `<article class="e360-panel e360-table-panel"><header><h3>Sugestão de abastecimento</h3><span>Necessidade após estoque, trânsito, pedidos e carteira</span></header>${this.table(["Loja","SKU","Produto","Curva","DDV","DDV proj.","Necessidade"], rows, (r) => [r.loja, r.sku, r.descricao, r.curva_abc, fmtNum(r.ddv_atual_31d), fmtNum(r.ddv_projetado_31d), fmtInt(r.necessidade_qtd)])}</article>`;
  }

  renderTransferencias(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = `<article class="e360-panel e360-table-panel"><header><h3>Transferências sugeridas</h3><span>Origem com excesso para destino com baixa cobertura</span></header>${this.table(["SKU","Produto","Origem","Destino","DDV origem","DDV destino","Sugestão"], rows, (r) => [r.sku, r.descricao, r.loja_origem, r.loja_destino, fmtNum(r.ddv_origem), fmtNum(r.ddv_destino), fmtInt(r.sugestao_qtd)])}</article>`;
  }

  renderPlano(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = `<article class="e360-panel e360-table-panel"><header><h3>Plano de ação</h3><span>Fila operacional priorizada automaticamente</span></header>${this.table(["Prioridade","Loja","SKU","Produto","Curva","DDV","Ruptura","Ação"], rows, (r) => [`<span class="e360-prioridade ${esc(r.prioridade)}">${esc(r.prioridade)}</span>`, r.loja, r.sku, r.descricao, r.curva_abc, fmtNum(r.ddv_atual_31d), r.ruptura ? "Sim" : "Não", String(r.acao || "").replaceAll("_", " ")], true)}</article>`;
  }

  table(headers, rows, mapRow, allowHtml = false) {
    if (!rows.length) return `<div class="e360-state">Nenhum registro encontrado para os filtros atuais.</div>`;
    return `<div class="e360-table-wrap"><table class="e360-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${mapRow(row).map((v, i) => `<td>${allowHtml && i === 0 ? v : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  destroy() {
    this.destroyed = true;
    if (this.controller) this.controller.abort();
    window.removeEventListener("resize", this._resize);
    this.charts.dispose();
    this.root.innerHTML = "";
  }
}

export function mountEstoque360(root, options = {}) {
  return new Estoque360App(root, options);
}
