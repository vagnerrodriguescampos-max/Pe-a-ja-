import { mountEstoque360 } from "./estoque360.js";

const PAGE_ID = "estoque360";
const NAV_SELECTOR = '[data-page="canais"]';
const VIEW_SELECTOR = "#view";
const STYLE_ID = "estoque360-style";
const STYLE_HREF = "/css/estoque360.css";

let appEstoque = null;
let navEstoque = null;
let iniciou = false;
let removers = [];

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

function filtrosAtuais() {
  if (typeof window.getEstoque360Filtros === "function") {
    const custom = window.getEstoque360Filtros();
    return custom && typeof custom === "object" ? custom : {};
  }

  const regional = valorSelect("fReg");
  const loja = textoSelect("fLoja");
  const categoria = valorSelect("fCat");
  const filtros = {};
  if (regional) filtros.regional = regional;
  if (loja) filtros.loja = loja;
  if (categoria) filtros.categoria = categoria;
  return filtros;
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
  appEstoque = mountEstoque360(root, { onContextChange: contextoParaIA });
  return appEstoque.start(filtrosAtuais());
}

function abrirEstoque(event) {
  // Impede apenas o roteador antigo de tentar interpretar uma página que ele ainda não conhece.
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
  if (!appEstoque) return;
  try { appEstoque.destroy(); } catch (_) {}
  appEstoque = null;
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

function observarFiltros() {
  const filterbar = document.getElementById("filterbar");
  if (filterbar) {
    const onChange = () => {
      if (appEstoque) appEstoque.setGlobalFilters(filtrosAtuais());
    };
    filterbar.addEventListener("change", onChange);
    removers.push(() => filterbar.removeEventListener("change", onChange));
  }

  const clear = document.getElementById("btnClear");
  if (clear) {
    const onClear = () => {
      if (!appEstoque) return;
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
    // O shell pode ainda estar sendo montado; uma única tentativa posterior é suficiente.
    window.addEventListener("load", () => {
      try { integrarEstoque360(); } catch (err) { console.error("Estoque 360:", err); }
    }, { once: true });
  }
}

autoStart();
