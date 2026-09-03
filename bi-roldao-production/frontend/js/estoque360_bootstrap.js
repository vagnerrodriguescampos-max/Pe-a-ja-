import { mountEstoque360 } from "./estoque360.js";

const PAGE_ID = "estoque360";
const NAV_SELECTOR = '[data-page="canais"]';
const VIEW_SELECTOR = "#view";
const STYLE_ID = "estoque360-style";
const STYLE_HREF = "/css/estoque360.css";
const EXTRA_ATTR = "data-e360-extra-filter";

let appEstoque = null;
let navEstoque = null;
let iniciou = false;
let removers = [];
let opcoesEstoque = {};
let autoPosicaoAplicada = false;

function garantirCss() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = STYLE_HREF;
  document.head.appendChild(link);
}

function svgEstoque() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7l8-4 8 4-8 4-8-4z"></path>
      <path d="M4 7v10l8 4 8-4V7"></path>
      <path d="M12 11v10"></path>
    </svg>`;
}

function criarNavItem() {
  const canal = document.querySelector(NAV_SELECTOR);
  if (!canal || canal.parentElement?.querySelector(`[data-page="${PAGE_ID}"]`)) {
    return canal?.parentElement?.querySelector(`[data-page="${PAGE_ID}"]`) || null;
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nav-item";
  btn.dataset.page = PAGE_ID;
  btn.innerHTML = `${svgEstoque()}<span>Estoque 360</span>`;
  canal.insertAdjacentElement("afterend", btn);
  return btn;
}

function valorSelect(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) return null;
  return String(el.value).trim() || null;
}

function textoSelect(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) return null;
  const opt = el.options?.[el.selectedIndex];
  const txt = String(opt?.textContent || "").trim();
  return txt && !/^(todas|todos)$/i.test(txt) ? txt : null;
}

function codigoLojaSelect() {
  const valor = valorSelect("fLoja");
  const texto = textoSelect("fLoja");
  if (!valor && !texto) return null;

  for (const candidato of [valor, texto]) {
    const match = String(candidato || "").match(/\bR\d{3,4}\b/i);
    if (match) return match[0].toUpperCase();
  }

  // O shell legado usa o número da loja (ex.: 18=Sorocaba) e a base de estoque usa R018.
  // A correspondência foi validada nas bases reais: 18/R018, 26/R026, 27/R027, 29/R029 e 37/R037.
  if (/^\d{1,4}$/.test(String(valor || ""))) {
    const n = String(Number(valor));
    return `R${n.padStart(3, "0")}`;
  }

  // Mantém compatibilidade se algum shell futuro passar diretamente o código/nome.
  return texto || valor;
}

function valorExtra(id) {
  const valor = valorSelect(id);
  return valor || null;
}

function filtrosAtuais() {
  if (typeof window.getEstoque360Filtros === "function") {
    const custom = window.getEstoque360Filtros();
    return custom && typeof custom === "object" ? custom : {};
  }

  const filtros = {};
  const pares = [
    ["regional", valorSelect("fReg")],
    ["loja", codigoLojaSelect()],
    // No BI legado, os valores de fCat coincidem com Departamento na base real de Estoque.
    ["departamento", valorSelect("fCat")],
    // Os valores de fSeg coincidem com Seção na base real de Estoque.
    ["secao", valorSelect("fSeg")],
    ["data_posicao", valorExtra("e360DataPosicao")],
    // Categoria do Estoque 360 representa a Sub-Categoria da base de Ruptura.
    ["categoria", valorExtra("e360Categoria")],
    ["fornecedor", valorExtra("e360Fornecedor")],
    ["comprador", valorExtra("e360Comprador")],
    ["curva_abc", valorExtra("e360CurvaABC")],
    ["top_300", valorExtra("e360Top300")],
    ["nbo", valorExtra("e360NBO")],
    ["tabloide", valorExtra("e360Tabloide")],
    ["status_estoque", valorExtra("e360Status")],
  ];
  pares.forEach(([chave, valor]) => { if (valor !== null && valor !== "") filtros[chave] = valor; });
  return filtros;
}

function criarFiltro(id, label, options = []) {
  const box = document.createElement("div");
  box.className = "fltr";
  box.setAttribute(EXTRA_ATTR, "1");
  const lbl = document.createElement("label");
  lbl.htmlFor = id;
  lbl.textContent = label;
  const select = document.createElement("select");
  select.id = id;
  box.append(lbl, select);
  preencherSelect(select, options, null);
  return box;
}

function labelData(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
}

function preencherSelect(select, valores, atual, labeler = x => x) {
  if (!select) return;
  const anterior = atual ?? select.value ?? "";
  select.innerHTML = "";
  const todos = document.createElement("option");
  todos.value = "";
  todos.textContent = "Todos";
  select.appendChild(todos);
  (valores || []).forEach(valor => {
    if (valor === null || valor === undefined || String(valor).trim() === "") return;
    const option = document.createElement("option");
    option.value = String(valor);
    option.textContent = String(labeler(valor));
    select.appendChild(option);
  });
  if ([...select.options].some(o => o.value === String(anterior))) select.value = String(anterior);
}

function montarFiltrosExtras() {
  const filterbar = document.getElementById("filterbar");
  if (!filterbar || filterbar.querySelector(`[${EXTRA_ATTR}]`)) return;
  const ancora = filterbar.querySelector(".filter-spacer") || document.getElementById("btnClear") || null;
  const defs = [
    ["e360DataPosicao", "Posição estoque"],
    ["e360Categoria", "Subcategoria estoque"],
    ["e360Fornecedor", "Fornecedor"],
    ["e360Comprador", "Comprador"],
    ["e360CurvaABC", "Curva ABC"],
    ["e360Top300", "Top 300", [["true", "Sim"], ["false", "Não"]]],
    ["e360NBO", "NBO", [["true", "Sim"], ["false", "Não"]]],
    ["e360Tabloide", "Tabloide", [["true", "Sim"], ["false", "Não"]]],
    ["e360Status", "Status estoque"],
  ];
  defs.forEach(([id, label, fixas]) => {
    const box = criarFiltro(id, label);
    if (fixas) {
      const select = box.querySelector("select");
      select.innerHTML = '<option value="">Todos</option>';
      fixas.forEach(([value, texto]) => {
        const o = document.createElement("option");
        o.value = value; o.textContent = texto; select.appendChild(o);
      });
    }
    filterbar.insertBefore(box, ancora);
  });
}

function removerFiltrosExtras() {
  document.querySelectorAll(`[${EXTRA_ATTR}]`).forEach(el => el.remove());
  opcoesEstoque = {};
  autoPosicaoAplicada = false;
}

function aplicarMesNaPosicao() {
  const mes = valorSelect("fMes");
  const select = document.getElementById("e360DataPosicao");
  if (!mes || !select) return false;
  const encontrada = [...select.options].find(o => o.value && o.value.startsWith(`${mes}-`));
  if (!encontrada || select.value === encontrada.value) return false;
  select.value = encontrada.value;
  return true;
}

function aplicarOpcoesFiltros(opcoes = {}) {
  opcoesEstoque = opcoes || {};
  preencherSelect(document.getElementById("e360DataPosicao"), opcoes.posicoes, valorExtra("e360DataPosicao"), labelData);
  preencherSelect(document.getElementById("e360Categoria"), opcoes.categorias, valorExtra("e360Categoria"));
  preencherSelect(document.getElementById("e360Fornecedor"), opcoes.fornecedores, valorExtra("e360Fornecedor"));
  preencherSelect(document.getElementById("e360Comprador"), opcoes.compradores, valorExtra("e360Comprador"));
  preencherSelect(document.getElementById("e360CurvaABC"), opcoes.curvas_abc, valorExtra("e360CurvaABC"));
  preencherSelect(document.getElementById("e360Status"), opcoes.status_estoque, valorExtra("e360Status"));

  if (!autoPosicaoAplicada && !valorExtra("e360DataPosicao")) {
    autoPosicaoAplicada = true;
    return aplicarMesNaPosicao();
  }
  return false;
}

async function postEstoque360(url, body, signal) {
  const resp = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (String(url).endsWith("/api/estoque/resumo")) {
    const mudouPosicao = aplicarOpcoesFiltros(data?.filtros_disponiveis || {});
    if (mudouPosicao) {
      setTimeout(() => appEstoque?.setGlobalFilters(filtrosAtuais()), 0);
    }
  }
  return data;
}

function marcarAtivo() {
  document.querySelectorAll(".nav-item.active").forEach(el => el.classList.remove("active"));
  navEstoque?.classList.add("active");
}

function contextoParaIA(detail) {
  window.__BI_CONTEXTO_ESTOQUE360__ = detail;
  window.dispatchEvent(new CustomEvent("bi:contexto-analista", { detail }));
}

function montarView() {
  const view = document.querySelector(VIEW_SELECTOR);
  if (!view) throw new Error("Container #view do BI não encontrado");

  if (appEstoque) {
    try { appEstoque.destroy(); } catch (_) {}
    appEstoque = null;
  }

  montarFiltrosExtras();
  view.innerHTML = `
    <div>
      <div class="view-head">
        <div>
          <h2>Estoque 360</h2>
          <p>Gestão de estoque, abastecimento e ruptura</p>
        </div>
        <div class="spacer"></div>
      </div>
      <div id="estoque360-root"></div>
    </div>`;

  const root = document.getElementById("estoque360-root");
  appEstoque = mountEstoque360(root, { onContextChange: contextoParaIA, post: postEstoque360 });
  return appEstoque.start(filtrosAtuais());
}

function abrirEstoque(event) {
  event?.preventDefault();
  event?.stopPropagation();
  event?.stopImmediatePropagation?.();
  marcarAtivo();
  Promise.resolve(montarView()).catch(err => {
    const view = document.querySelector(VIEW_SELECTOR);
    if (view) view.innerHTML = `<div class="card"><div class="card-h"><h3>Estoque 360</h3></div><div class="card-b" style="color:var(--crit)">${String(err?.message || err)}</div></div>`;
  });
}

function sairDoEstoque() {
  if (appEstoque) {
    try { appEstoque.destroy(); } catch (_) {}
    appEstoque = null;
  }
  removerFiltrosExtras();
  navEstoque?.classList.remove("active");
  delete window.__BI_CONTEXTO_ESTOQUE360__;
}

function observarNavegacao() {
  const nav = document.getElementById("nav") || navEstoque?.parentElement;
  if (!nav) return;

  const onNavCapture = event => {
    const item = event.target.closest?.(".nav-item");
    if (!item) return;
    if (item === navEstoque) return abrirEstoque(event);
    if (appEstoque) sairDoEstoque();
  };
  nav.addEventListener("click", onNavCapture, true);
  removers.push(() => nav.removeEventListener("click", onNavCapture, true));
}

function limparFiltrosExtras() {
  document.querySelectorAll(`[${EXTRA_ATTR}] select`).forEach(el => { el.value = ""; });
  autoPosicaoAplicada = false;
}

function observarFiltros() {
  const filterbar = document.getElementById("filterbar");
  if (filterbar) {
    const onChange = event => {
      if (!appEstoque) return;
      if (event?.target?.id === "fMes") aplicarMesNaPosicao();
      appEstoque.setGlobalFilters(filtrosAtuais());
    };
    filterbar.addEventListener("change", onChange);
    removers.push(() => filterbar.removeEventListener("change", onChange, true));
  }

  const clear = document.getElementById("btnClear");
  if (clear) {
    const onClear = () => {
      if (!appEstoque) return;
      limparFiltrosExtras();
      setTimeout(() => appEstoque?.setGlobalFilters(filtrosAtuais()), 0);
    };
    clear.addEventListener("click", onClear);
    removers.push(() => clear.removeEventListener("click", onClear));
  }
}

export function integrarEstoque360() {
  if (iniciou) return { nav: navEstoque, get app() { return appEstoque; } };
  garantirCss();
  navEstoque = criarNavItem();
  if (!navEstoque) throw new Error("Item Canais não encontrado; Estoque 360 não foi inserido.");
  observarNavegacao();
  observarFiltros();
  iniciou = true;
  return { nav: navEstoque, get app() { return appEstoque; } };
}

export function removerIntegracaoEstoque360() {
  sairDoEstoque();
  removers.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
  navEstoque?.remove();
  navEstoque = null;
  iniciou = false;
}

function autoStart() {
  try { integrarEstoque360(); }
  catch (_) {
    window.addEventListener("load", () => {
      try { integrarEstoque360(); } catch (err) { console.error("Estoque 360:", err); }
    }, { once: true });
  }
}

autoStart();
