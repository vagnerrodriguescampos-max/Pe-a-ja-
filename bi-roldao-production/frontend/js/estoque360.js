const TABS = [
  ["cockpit", "Cockpit"],
  ["ruptura", "Ruptura"],
  ["cobertura", "Cobertura"],
  ["excesso", "Excesso"],
  ["abastecimento", "Abastecimento"],
  ["transferencias", "Transferências"],
  ["plano-acao", "Plano de Ação"],
];

const ENDPOINTS = {
  resumo: "/api/estoque/resumo",
  ruptura: "/api/estoque/ruptura",
  cobertura: "/api/estoque/cobertura",
  excesso: "/api/estoque/excesso",
  abastecimento: "/api/estoque/abastecimento",
  transferencias: "/api/estoque/transferencias",
  "plano-acao": "/api/estoque/plano-acao",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const n0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(v) { return Number.isFinite(Number(v)) ? brl.format(Number(v)) : "—"; }
function num(v) { return Number.isFinite(Number(v)) ? n1.format(Number(v)) : "—"; }
function inteiro(v) { return Number.isFinite(Number(v)) ? n0.format(Number(v)) : "—"; }
function pct(v) { return Number.isFinite(Number(v)) ? `${n1.format(Number(v))}%` : "—"; }
function dataBR(v) {
  if (!v) return "—";
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString("pt-BR");
}
function dataHoraBR(v) {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function cssVar(nome, fallback) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return valor || fallback;
}

function coresBI() {
  return [
    cssVar("--brand", "#fdb913"),
    cssVar("--s1", "#2f80ed"),
    cssVar("--s3", "#27ae60"),
    cssVar("--s6", "#9b51e0"),
    cssVar("--warn", "#f2994a"),
    cssVar("--crit", "#eb5757"),
  ];
}

class Charts {
  constructor() { this.map = new Map(); }
  set(root, id, option) {
    if (!window.echarts) return false;
    const dom = root.querySelector(`#${CSS.escape(id)}`);
    if (!dom || !dom.isConnected) return false;
    const antigo = this.map.get(id);
    if (antigo && antigo.dom !== dom) {
      try { antigo.chart.dispose(); } catch (_) {}
      this.map.delete(id);
    }
    let chart = window.echarts.getInstanceByDom(dom);
    if (!chart) chart = window.echarts.init(dom);
    chart.setOption({ color: coresBI(), ...option }, { notMerge: true, lazyUpdate: false });
    this.map.set(id, { dom, chart });
    requestAnimationFrame(() => { try { if (dom.isConnected) chart.resize(); } catch (_) {} });
    return true;
  }
  cleanup(root) {
    for (const [id, item] of this.map.entries()) {
      if (!item.dom.isConnected || !root.contains(item.dom)) {
        try { item.chart.dispose(); } catch (_) {}
        this.map.delete(id);
      }
    }
  }
  resize() { for (const { chart } of this.map.values()) { try { chart.resize(); } catch (_) {} } }
  dispose() { for (const { chart } of this.map.values()) { try { chart.dispose(); } catch (_) {} } this.map.clear(); }
}

async function postPadrao(url, body, signal) {
  const resp = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function kpiHost({ title, value, accent = "--brand", cmp = "" }) {
  if (typeof window.kpiCard === "function") {
    try {
      return window.kpiCard({ title, value, accent, cmp, src: "calc" });
    } catch (_) {}
  }
  return `<div class="card"><div class="card-h"><h3>${esc(title)}</h3></div><div class="card-b"><div style="font-size:22px;font-weight:800">${esc(value)}</div>${cmp ? `<div style="margin-top:5px;color:var(--ink-3);font-size:11px">${esc(cmp)}</div>` : ""}</div></div>`;
}

function card(titulo, corpo, hint = "") {
  return `<div class="card"><div class="card-h"><h3>${esc(titulo)}</h3>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div><div class="card-b">${corpo}</div></div>`;
}

function tabela(cabecalhos, linhas, getter) {
  return `<div class="e360-table-wrap"><table class="e360-table"><thead><tr>${cabecalhos.map(x => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${linhas.map(r => `<tr>${getter(r).map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export class Estoque360App {
  constructor(root, options = {}) {
    if (!root) throw new Error("Container do Estoque 360 não informado");
    this.root = root;
    this.options = options;
    this.endpoints = { ...ENDPOINTS, ...(options.endpoints || {}) };
    this.post = options.post || postPadrao;
    this.tab = "cockpit";
    this.filtros = {};
    this.seq = 0;
    this.controller = null;
    this.charts = new Charts();
    this.destroyed = false;
    this.onResize = () => this.charts.resize();
    window.addEventListener("resize", this.onResize, { passive: true });
    this.renderShell();
  }

  renderShell() {
    this.root.classList.add("estoque360");
    this.root.innerHTML = `
      <div class="e360-toolbar">
        <div class="e360-tabs" role="tablist" aria-label="Estoque 360">
          ${TABS.map(([id, label]) => `<button type="button" class="btn ${id === this.tab ? "primary" : ""}" data-e360-tab="${id}">${esc(label)}</button>`).join("")}
        </div>
        <div class="e360-posicao"><span class="src-tag src-calc">POSIÇÃO</span><b data-e360-posicao>—</b></div>
      </div>
      <div class="e360-content" data-e360-content></div>`;
    this.root.querySelectorAll("[data-e360-tab]").forEach(btn => {
      btn.addEventListener("click", () => this.setTab(btn.dataset.e360Tab));
    });
  }

  async start(filtros = {}) { this.filtros = { ...filtros }; await this.refresh(); return this; }
  async setGlobalFilters(filtros = {}) { this.filtros = { ...filtros }; await this.refresh(); }

  async setTab(tab) {
    if (!TABS.some(([id]) => id === tab) || tab === this.tab) return;
    this.tab = tab;
    this.root.querySelectorAll("[data-e360-tab]").forEach(btn => {
      const ativo = btn.dataset.e360Tab === tab;
      btn.classList.toggle("primary", ativo);
      btn.setAttribute("aria-selected", ativo ? "true" : "false");
    });
    await this.refresh();
  }

  payload(extra = {}) {
    const base = { ...this.filtros };
    delete base.periodo_inicio;
    delete base.periodo_fim;
    return { ...base, ...extra };
  }

  contextoIA(dataPosicao) {
    const detail = { modulo: "ESTOQUE_360", subaba: this.tab, data_posicao: dataPosicao || null, filtros: { ...this.filtros } };
    this.root.dispatchEvent(new CustomEvent("estoque360:contexto", { bubbles: true, detail }));
    if (typeof this.options.onContextChange === "function") this.options.onContextChange(detail);
  }

  setLoading() {
    this.root.querySelector("[data-e360-content]").innerHTML = `<div class="e360-state"><span class="e360-spinner"></span>Atualizando indicadores…</div>`;
  }

  setError(err) {
    this.root.querySelector("[data-e360-content]").innerHTML = card("Falha ao carregar Estoque 360", `<div style="color:var(--crit)">${esc(err?.message || err)}</div>`);
  }

  async request(nome, extra, signal) {
    const url = this.endpoints[nome];
    if (!url) throw new Error(`Endpoint não configurado: ${nome}`);
    return this.post(url, this.payload(extra), signal);
  }

  async refresh() {
    if (this.destroyed) return;
    const seq = ++this.seq;
    if (this.controller) this.controller.abort();
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.setLoading();
    try {
      let result;
      if (this.tab === "cockpit") {
        const [resumo, cobertura] = await Promise.all([
          this.request("resumo", {}, signal),
          this.request("cobertura", {}, signal),
        ]);
        result = { resumo, cobertura };
      } else if (this.tab === "ruptura") result = await this.request("ruptura", { dimensao: "loja", limite: 60 }, signal);
      else if (this.tab === "cobertura") result = await this.request("cobertura", {}, signal);
      else if (this.tab === "excesso") result = await this.request("excesso", { limite: 250 }, signal);
      else if (this.tab === "abastecimento") result = await this.request("abastecimento", { limite: 250 }, signal);
      else if (this.tab === "transferencias") result = await this.request("transferencias", { limite: 250 }, signal);
      else result = await this.request("plano-acao", { limite: 400 }, signal);
      if (seq !== this.seq || signal.aborted || this.destroyed) return;
      this.renderResult(result);
    } catch (err) {
      if (err?.name === "AbortError" || seq !== this.seq || this.destroyed) return;
      this.setError(err);
    }
  }

  updatePosicao(v) {
    const el = this.root.querySelector("[data-e360-posicao]");
    if (el) el.textContent = dataBR(v);
  }

  renderSemAcesso() {
    this.updatePosicao(null);
    this.root.querySelector("[data-e360-content]").innerHTML = card("Sem acesso", "Seu usuário não possui lojas liberadas para esta consulta.");
  }

  renderResult(result) {
    this.charts.cleanup(this.root);
    if (this.tab === "cockpit") return this.renderCockpit(result.resumo, result.cobertura);
    if (result?.sem_acesso) return this.renderSemAcesso();
    const posicao = result?.data_posicao || result?.posicao?.data_posicao;
    this.updatePosicao(posicao);
    this.contextoIA(posicao);
    const dados = result?.dados || [];
    if (this.tab === "ruptura") return this.renderRuptura(dados);
    if (this.tab === "cobertura") return this.renderCobertura(dados);
    if (this.tab === "excesso") return this.renderExcesso(dados);
    if (this.tab === "abastecimento") return this.renderAbastecimento(dados);
    if (this.tab === "transferencias") return this.renderTransferencias(dados);
    return this.renderPlano(dados);
  }

  renderCockpit(resumoResp, coberturaResp) {
    if (resumoResp?.sem_acesso) return this.renderSemAcesso();
    const d = resumoResp?.dados || {};
    const q = resumoResp?.qualidade_posicao || {};
    const posicao = resumoResp?.data_posicao || d.data_posicao;
    this.updatePosicao(posicao);
    this.contextoIA(posicao);

    const saudeLabel = q.status === "SAUDAVEL" ? "Saudável" : q.status === "ATENCAO" ? "Atenção" : "Crítico";
    const saudeAccent = q.nivel === "VERDE" ? "--s3" : q.nivel === "AMARELO" ? "--warn" : "--crit";
    const saudeCmp = `Estoque ${dataBR(q.data_estoque)} · Ruptura ${dataBR(q.data_ruptura)}`;
    const kpis = [
      ["Saúde da posição", saudeLabel, saudeAccent, saudeCmp],
      ["Estoque disponível", money(d.estoque_valor), "--brand", "Valor disponível"],
      ["DDV atual", `${num(d.ddv_atual)} dias`, "--s1", "Cobertura atual"],
      ["DDV projetado", `${num(d.ddv_projetado)} dias`, "--s3", "Com trânsito + pedidos + carteira"],
      ["Ruptura", pct(d.ruptura_pct), "--crit", "Itens ativos em ruptura"],
      ["Ruptura sem pedido", inteiro(d.ruptura_sem_pedido), "--crit", "Ação imediata"],
      ["Ruptura com pedido", inteiro(d.ruptura_com_pedido), "--warn", "Acompanhar abastecimento"],
      ["Compra sugerida", inteiro(d.compra_sugerida_qtd), "--crit", money(d.compra_valor_estimado)],
      ["Potencial transferência", inteiro(d.transferencia_potencial_qtd), "--s3", money(d.transferencia_valor_estimado)],
      ["Ações P1", inteiro(d.acoes_p1), "--crit", "Prioridade imediata"],
      ["Ações P2", inteiro(d.acoes_p2), "--warn", "Atenção operacional"],
      ["Carteira", money(d.carteira_valor), "--s6", "Valor em carteira"],
      ["Capital liberável", money(d.capital_excedente_estimado), "--warn", `Estimado acima de ${num(d.ddv_alvo)} dias`],
      ["Estoque sem venda", money(d.estoque_sem_venda_valor), "--ink-3", "Sem venda no período-base"],
    ];

    const cargas = [
      ["Estoque", q.ultima_carga_estoque],
      ["Ruptura", q.ultima_carga_ruptura],
    ];
    const auditoria = tabela(
      ["Base","Posição","Status","Linhas válidas","Rejeitadas","Arquivo"],
      cargas,
      ([base, carga]) => [
        base,
        dataBR(carga?.data_posicao),
        carga?.status || "SEM CARGA",
        inteiro(carga?.linhas_validas),
        inteiro(carga?.linhas_rejeitadas),
        carga?.arquivo_nome || "—",
      ],
    );
    const alertas = Array.isArray(q.alertas) && q.alertas.length
      ? `<div>${q.alertas.map(a => `<div class="e360-note">• ${esc(a)}</div>`).join("")}</div>`
      : `<div class="e360-note">Nenhum alerta de qualidade na posição atual.</div>`;
    const detalheQualidade = `
      <div class="e360-note"><b>${esc(q.mensagem || "")}</b></div>
      <div class="e360-note">Posição operacional: ${dataBR(q.data_operacional)} · Última atualização: ${dataHoraBR(q.ultima_atualizacao)}</div>
      <div class="e360-note">Linhas promovidas — Estoque: ${inteiro(q.linhas_posicao_estoque)} · Ruptura: ${inteiro(q.linhas_posicao_ruptura)} · Falhas por duplicidade no histórico: ${inteiro(q.falhas_duplicidade_historico)}</div>
      ${alertas}`;

    this.root.querySelector("[data-e360-content]").innerHTML = `
      <div class="kpi-grid e360-kpis">${kpis.map(([title,value,accent,cmp]) => kpiHost({title,value,accent,cmp})).join("")}</div>
      <div class="e360-two">
        ${card("Qualidade da carga", auditoria, `Saúde: ${saudeLabel}`)}
        ${card("Situação da posição", detalheQualidade, q.datas_alinhadas ? "Bases alinhadas" : "Verificar alinhamento")}
      </div>
      <div class="e360-two">
        ${card("Distribuição da cobertura", `<div id="e360-cobertura" class="e360-chart"></div>`, "Itens por faixa de DDV")}
        ${card("DDV atual x projetado", `<div class="e360-ddv"><div><small>Atual</small><strong>${num(d.ddv_atual)}</strong><span>dias</span></div><div class="e360-ddv-arrow">→</div><div><small>Projetado</small><strong>${num(d.ddv_projetado)}</strong><span>dias</span></div></div><div class="e360-note">O projetado considera estoque disponível, trânsito, pedido pendente e carteira. Compra e transferência usam as mesmas regras das filas operacionais.</div>`)}
      </div>`;
    this.chartCobertura(coberturaResp?.dados || []);
  }

  chartCobertura(rows) {
    this.charts.set(this.root, "e360-cobertura", {
      tooltip: { trigger: "axis" },
      grid: { left: 48, right: 18, top: 24, bottom: 40 },
      xAxis: { type: "category", data: rows.map(r => r.faixa), axisLabel: { interval: 0, rotate: 25, color: cssVar("--ink-3", "#888") } },
      yAxis: { type: "value", axisLabel: { color: cssVar("--ink-3", "#888") }, splitLine: { lineStyle: { color: cssVar("--line", "#ddd") } } },
      series: [{ type: "bar", data: rows.map(r => Number(r.itens || 0)), barMaxWidth: 42 }],
    });
  }

  renderRuptura(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = `<div class="e360-two">${card("Ruptura por loja", `<div id="e360-ruptura" class="e360-chart e360-chart-lg"></div>`, "Percentual de ruptura")}${card("Detalhamento", tabela(["Loja","Ruptura %","Itens","Sem pedido","Com pedido"], rows, r => [r.dimensao,pct(r.ruptura_pct),inteiro(r.ruptura),inteiro(r.sem_pedido),inteiro(r.com_pedido)]))}</div>`;
    const top = rows.slice(0, 20);
    this.charts.set(this.root, "e360-ruptura", {
      tooltip: { trigger: "axis" },
      grid: { left: 115, right: 22, top: 18, bottom: 24 },
      xAxis: { type: "value", axisLabel: { formatter: "{value}%", color: cssVar("--ink-3", "#888") }, splitLine: { lineStyle: { color: cssVar("--line", "#ddd") } } },
      yAxis: { type: "category", inverse: true, data: top.map(r => r.dimensao || "—"), axisLabel: { color: cssVar("--ink-3", "#888") } },
      series: [{ type: "bar", data: top.map(r => Number(r.ruptura_pct || 0)), barMaxWidth: 18 }],
    });
  }

  renderCobertura(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = card("Cobertura / DDV", `<div id="e360-cobertura-full" class="e360-chart e360-chart-lg"></div>`, "Faixas de cobertura da posição selecionada");
    this.charts.set(this.root, "e360-cobertura-full", {
      tooltip: { trigger: "axis" },
      grid: { left: 50, right: 25, top: 22, bottom: 42 },
      xAxis: { type: "category", data: rows.map(r => r.faixa), axisLabel: { color: cssVar("--ink-3", "#888") } },
      yAxis: { type: "value", axisLabel: { color: cssVar("--ink-3", "#888") }, splitLine: { lineStyle: { color: cssVar("--line", "#ddd") } } },
      series: [{ type: "bar", data: rows.map(r => Number(r.estoque_valor || 0)) }],
    });
  }

  renderExcesso(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = card("Excesso de estoque", tabela(["Loja","SKU","Produto","Curva","DDV","Estoque R$","Excesso R$"], rows, r => [r.loja,r.sku,r.descricao,r.curva_abc,num(r.ddv_atual_31d),money(r.estoque_disponivel_valor),money(r.excesso_valor)]), "Prioridade por capital excedente");
  }

  renderAbastecimento(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = card("Sugestão de abastecimento", tabela(["Loja","SKU","Produto","Curva","DDV atual","DDV projetado","Necessidade"], rows, r => [r.loja,r.sku,r.descricao,r.curva_abc,num(r.ddv_atual_31d),num(r.ddv_projetado_31d),inteiro(r.necessidade_qtd)]), "Recomendação analítica; não gera pedido automático");
  }

  renderTransferencias(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = card("Transferências possíveis", tabela(["SKU","Produto","Origem","DDV origem","Destino","DDV destino","Sugestão"], rows, r => [r.sku,r.descricao,r.loja_origem,num(r.ddv_origem),r.loja_destino,num(r.ddv_destino),inteiro(r.sugestao_qtd)]), "Excesso em uma loja x baixa cobertura em outra");
  }

  renderPlano(rows) {
    this.root.querySelector("[data-e360-content]").innerHTML = card(
      "Plano de ação",
      tabela(
        ["Prioridade","Loja","SKU","Ação","Motivo","Transferência","Compra","Responsável"],
        rows,
        r => [
          r.prioridade,
          r.loja,
          r.sku,
          r.acao_label || r.acao,
          r.motivo_label || r.motivo,
          inteiro(r.transferencia_sugerida_qtd),
          inteiro(r.compra_sugerida_qtd),
          [r.responsavel_area, r.responsavel_referencia].filter(Boolean).join(" · "),
        ],
      ),
      "Fila operacional ordenada por criticidade e decisão recomendada",
    );
  }

  destroy() {
    this.destroyed = true;
    if (this.controller) this.controller.abort();
    this.charts.dispose();
    window.removeEventListener("resize", this.onResize);
    this.root.innerHTML = "";
    this.root.classList.remove("estoque360");
  }
}

export function mountEstoque360(root, options = {}) {
  return new Estoque360App(root, options);
}
