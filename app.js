(() => {
  const INSTRUMENTS = [
    ["bateria", "Bateria"],
    ["baixo", "Baixo"],
    ["guitarra", "Guitarra"],
    ["violao", "Violão"],
    ["teclado", "Teclado"],
  ];
  const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const INSTRUMENT_CLASS = Object.fromEntries(INSTRUMENTS.map(([k]) => [k, `inst-${k}`]));

  function ministryClass(name) {
    const n = (name || "").toLowerCase();
    if (n.includes("crian")) return "min-criancas";
    if (n.includes("irmã") || n.includes("irma") || n.includes("círculo") || n.includes("circulo")) return "min-irmas";
    if (n.includes("jovens e adol") || n.includes("jovens/adol")) return "min-ja";
    if (n.startsWith("jovens") || n === "jovem") return "min-jovens";
    if (n.includes("adol")) return "min-adolescentes";
    if (n.includes("louvor")) return "min-louvor";
    return "min-other";
  }

  function isSantaCeia(obs) {
    return /santa\s*ceia/i.test(obs || "");
  }

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  let DATA = null;
  let year = 2026;
  let query = "";
  let view = "geral";
  let onceOpen = false;
  let GERAL = null;

  function parseISO(iso) {
    if (!iso || typeof iso !== "string") return null;
    const parts = iso.split("-").map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  }
  function fmtDay(iso) {
    const dt = parseISO(iso);
    if (!dt) return iso || "—";
    const wd = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][dt.getDay()];
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")} (${wd})`;
  }
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function todayLocal() {
    // America/Sao_Paulo — box clock already in that zone
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function monthsOfYear(y) {
    return DATA.meses.filter((m) => m.ano === y);
  }

  function allCultos(y) {
    return monthsOfYear(y).flatMap((m) =>
      (m.cultos || []).map((c) => ({ ...c, mesId: m.id, mesNome: m.nome }))
    );
  }

  function currentMonth() {
    const t = todayLocal();
    const id = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
    return DATA.meses.find((m) => m.id === id) || null;
  }

  function songKey(s) {
    return (s.titulo || "").trim().toLowerCase();
  }
  function artistKey(s) {
    return (s.artista || "").trim().toLowerCase();
  }

  function statsForYear(y) {
    const cultos = allCultos(y);
    const songs = Counter();
    const artists = Counter();
    const byInst = Object.fromEntries(INSTRUMENTS.map(([k]) => [k, Counter()]));

    for (const c of cultos) {
      for (const s of c.musicas || []) {
        const t = songKey(s);
        if (t && t !== "—" && t !== "-") songs.inc(s.titulo.trim(), s.titulo.trim());
        const a = artistKey(s);
        if (a) artists.inc(s.artista.trim(), s.artista.trim());
      }
      const b = c.banda;
      if (b) {
        for (const [k] of INSTRUMENTS) {
          const who = (b[k] || "").trim();
          if (who) byInst[k].inc(who, who);
        }
      }
    }
    return {
      cultos: cultos.length,
      topSongs: songs.top(10),
      topArtists: artists.top(8),
      topPlayers: Object.fromEntries(
        INSTRUMENTS.map(([k, label]) => [k, { label, list: byInst[k].top(5) }])
      ),
    };
  }

  function Counter() {
    const map = new Map();
    return {
      inc(key, label) {
        const cur = map.get(key) || { key, label, n: 0 };
        cur.n += 1;
        map.set(key, cur);
      },
      top(n) {
        return [...map.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, n);
      },
    };
  }

  function renderSongs(musicas) {
    if (!musicas || !musicas.length) return `<p class="empty">Sem músicas listadas</p>`;
    return musicas
      .map((s) => {
        const art = s.artista ? `<div class="art">${esc(s.artista)}</div>` : "";
        const mc = ministryClass(s.ministerio);
        return `<div class="song-row ${mc}"><div class="min"><span class="dot" aria-hidden="true"></span>${esc(s.ministerio || "")}</div><div><div class="tit">${esc(s.titulo || "")}</div>${art}</div></div>`;
      })
      .join("");
  }

  function barList(items, variant) {
    if (!items.length) return `<p class="empty">Sem dados neste ano</p>`;
    const max = Math.max(...items.map((it) => it.n), 1);
    return `<div class="bar-list bars-${esc(variant || "songs")}">${items
      .map(
        (it) => `<div class="bar-row">
          <div class="name" title="${esc(it.label)}">${esc(it.label)}</div>
          <div class="val">${it.n}×</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (it.n / max) * 100)}%"></div></div>
        </div>`
      )
      .join("")}</div>`;
  }

  function renderDash() {
    const st = statsForYear(year);
    // Top player per instrument, sorted by count desc so Flávio 32× appears above Max 28×
    const perInst = INSTRUMENTS.map(([k, label]) => {
      const top = st.topPlayers[k].list[0];
      return top ? { label: `${top.label} · ${label}`, n: top.n, key: k + top.key } : null;
    })
      .filter(Boolean)
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));

    $("#dash").innerHTML = `
      <div class="section-title"><h2>Painel ${year}</h2><span class="meta">só meses com dados</span></div>
      <div class="dash-grid">
        <div class="card stat">
          <div>
            <div class="num">${st.cultos}</div>
            <div class="label">cultos no ano ${year}</div>
          </div>
          <div class="stat-side">Contagem a partir das escalas e listas de hinos deste ano</div>
        </div>
        <div class="card panel">
          <h3>Músicas mais cantadas</h3>
          ${barList(st.topSongs, "songs")}
        </div>
        <div class="card panel">
          <h3>Quem mais tocou</h3>
          ${barList(perInst, "players")}
          <p class="empty" style="margin:.65rem 0 0;font-size:.72rem">1º de cada instrumento, ordenado por vezes</p>
        </div>
        <div class="card panel">
          <h3>Artistas mais cantados</h3>
          ${barList(st.topArtists, "artists")}
        </div>
      </div>`;
  }

  function renderMonths() {
    const months = monthsOfYear(year).slice().reverse();
    if (!months.length) {
      $("#months").innerHTML = `<p class="empty">Nenhum mês em ${year}.</p>`;
      return;
    }
    $("#months").innerHTML = `
      <div class="section-title"><h2>Meses de ${year}</h2><span class="meta">${months.length} mês(es)</span></div>
      <div class="months">${months
        .map((m) => {
          const n = (m.cultos || []).length;
          const ensList = (m.ensaios || []).filter((e) => e && e.data);
          const ens =
            ensList.length
              ? `<div class="ensaios">Ensaios: ${ensList
                  .map((e) => `${esc(fmtDay(e.data))}${e.horario ? " " + esc(e.horario) : ""}`)
                  .join(" · ")}</div>`
              : "";
          const cultos = (m.cultos || [])
            .map((c) => {
              const obs = isSantaCeia(c.observacao)
                ? `<span class="obs-santa">${esc(c.observacao)}</span>`
                : (c.observacao ? `<span class="badge">${esc(c.observacao)}</span>` : "<span></span>");
              const kv = INSTRUMENTS.map(([k, label]) => {
                const who = (c.banda?.[k] || "").trim();
                const empty = !who;
                return `<div class="${INSTRUMENT_CLASS[k]}"><span class="k">${esc(label)}</span><span class="v${empty ? " is-empty" : ""}">${empty ? "—" : esc(who)}</span></div>`;
              }).join("");
              return `<article class="culto">
                <div class="culto-head"><strong>${esc(fmtDay(c.data))}</strong>${obs}</div>
                <div class="culto-grid">
                  <div class="culto-band"><div class="kv">${kv}</div></div>
                  <div class="culto-songs">${renderSongs(c.musicas)}</div>
                </div>
              </article>`;
            })
            .join("");
          const open = m.id === currentMonth()?.id ? " open" : "";
          return `<details class="month${m.completo ? "" : " parcial"}"${open}>
            <summary>
              <span class="left"><span class="dot" title="${m.completo ? "completo" : "parcial"}"></span><span>${esc(m.nome)}</span></span>
              <span style="display:flex;align-items:center;gap:.65rem">
                <span class="count">${n} culto${n === 1 ? "" : "s"}</span>
                <span class="chev" aria-hidden="true"></span>
              </span>
            </summary>
            <div class="month-body">${ens}${cultos || '<p class="empty">Sem cultos</p>'}</div>
          </details>`;
        })
        .join("")}</div>`;
  }

  function searchAll(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];
    for (const m of DATA.meses) {
      for (const c of m.cultos || []) {
        if (c.banda) {
          for (const [k, label] of INSTRUMENTS) {
            const who = (c.banda[k] || "").toLowerCase();
            if (who.includes(q)) {
              hits.push({
                kind: "músico",
                title: `${c.banda[k]} · ${label}`,
                when: `${fmtDay(c.data)} · ${m.nome}`,
              });
            }
          }
        }
        for (const s of c.musicas || []) {
          const blob = `${s.titulo || ""} ${s.artista || ""} ${s.ministerio || ""}`.toLowerCase();
          if (blob.includes(q)) {
            hits.push({
              kind: "música",
              title: `${s.titulo || ""}${s.artista ? " — " + s.artista : ""}`,
              when: `${fmtDay(c.data)} · ${s.ministerio || ""} · ${m.nome}`,
            });
          }
        }
      }
    }
    // dedupe by title+when
    const seen = new Set();
    return hits.filter((h) => {
      const k = h.kind + h.title + h.when;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 40);
  }

  function renderSearch() {
    const panel = $("#searchPanel");
    if (query.trim().length < 2) {
      panel.classList.remove("visible");
      panel.innerHTML = "";
      return;
    }
    const hits = searchAll(query);
    panel.classList.add("visible");
    panel.innerHTML = `
      <div class="section-title"><h2>Busca</h2><span class="meta">${hits.length} resultado(s) para “${esc(query)}”</span></div>
      <div class="card card-pad search-hits">
        ${
          hits.length
            ? hits
                .map(
                  (h) =>
                    `<div class="hit"><span class="tag">${esc(h.kind)}</span><strong>${esc(h.title)}</strong><div class="when">${esc(h.when)}</div></div>`
                )
                .join("")
            : `<p class="empty">Nada encontrado.</p>`
        }
      </div>`;
  }

  function normTitle(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function songParts(title) {
    const raw = String(title || "").trim();
    if (!raw) return [];
    return raw.split(/\s*\+\s*/).map((p) => p.trim()).filter((p) => {
      const k = normTitle(p);
      return k && k !== "-" && k !== "—" && k !== "–";
    });
  }

  function bumpCount(map, label) {
    const key = label.trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  }

  function bestLabel(map) {
    let best = "";
    let n = -1;
    for (const [label, count] of map) {
      if (count > n || (count === n && label.localeCompare(best, "pt") < 0)) {
        best = label;
        n = count;
      }
    }
    return best;
  }

  function fmtDate(iso) {
    const dt = parseISO(iso);
    if (!dt) return "—";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${dt.getFullYear()}`;
  }

  function monthsAgo(iso) {
    const dt = parseISO(iso);
    const t = todayLocal();
    if (!dt) return 0;
    let m = (t.getFullYear() - dt.getFullYear()) * 12 + (t.getMonth() - dt.getMonth());
    if (t.getDate() < dt.getDate()) m -= 1;
    return Math.max(0, m);
  }

  function agoLabel(iso) {
    const m = monthsAgo(iso);
    if (m <= 0) return "há menos de 1 mês";
    if (m === 1) return "há 1 mês";
    return `há ${m} meses`;
  }

  function yearsCovered(values) {
    const ys = [...values].sort((a, b) => a - b);
    if (!ys.length) return "";
    if (ys.length === 1) return String(ys[0]);
    const contig = ys.every((y, i) => i === 0 || y === ys[i - 1] + 1);
    return contig ? `${ys[0]}–${ys[ys.length - 1]}` : ys.join(", ");
  }

  function buildGeral() {
    const songs = new Map();
    const artists = new Map();
    let cultos = 0;
    const years = new Set();
    for (const m of DATA.meses || []) {
      for (const c of m.cultos || []) {
        cultos += 1;
        if (m.ano) years.add(m.ano);
        const dt = c.data || "";
        for (const s of c.musicas || []) {
          const art = (s.artista || "").trim();
          const artKey = normTitle(art);
          if (artKey && artKey !== "-" && artKey !== "—" && artKey !== "–") {
            let arec = artists.get(artKey);
            if (!arec) {
              arec = { n: 0, labels: new Map() };
              artists.set(artKey, arec);
            }
            arec.n += 1;
            bumpCount(arec.labels, art);
          }
          for (const part of songParts(s.titulo)) {
            const key = normTitle(part);
            if (!key) continue;
            let rec = songs.get(key);
            if (!rec) {
              rec = { n: 0, labels: new Map(), arts: new Map(), when: "" };
              songs.set(key, rec);
            }
            rec.n += 1;
            bumpCount(rec.labels, part);
            if (art) bumpCount(rec.arts, art);
            if (dt && (!rec.when || dt > rec.when)) rec.when = dt;
            if (dt && rec.n === 1) rec.when = dt;
          }
        }
      }
    }
    const songList = [...songs.values()].map((rec) => ({
      title: bestLabel(rec.labels),
      artist: bestLabel(rec.arts),
      n: rec.n,
      when: rec.when,
    }));
    const byTitle = (a, b) => a.title.localeCompare(b.title, "pt");
    const topSongs = songList.slice().sort((a, b) => b.n - a.n || byTitle(a, b)).slice(0, 10);
    const topArtists = [...artists.values()]
      .map((rec) => ({ title: bestLabel(rec.labels), n: rec.n }))
      .sort((a, b) => b.n - a.n || a.title.localeCompare(b.title, "pt"))
      .slice(0, 10);
    const baixa = songList
      .filter((s) => s.n >= 2 && s.when)
      .sort((a, b) => a.when.localeCompare(b.when) || a.n - b.n || byTitle(a, b))
      .slice(0, 10);
    const once = songList
      .filter((s) => s.n === 1)
      .sort((a, b) => (a.when || "").localeCompare(b.when || "") || byTitle(a, b));
    return {
      cultos,
      songs: songList.length,
      artists: artists.size,
      years: yearsCovered(years),
      topSongs,
      topArtists,
      baixa,
      once,
    };
  }

  function geralBars(items, variant) {
    if (!items.length) return `<p class="empty">Sem dados</p>`;
    const max = Math.max(...items.map((it) => it.n), 1);
    return `<div class="bar-list bars-${variant}">${items
      .map((it) => {
        const art = it.artist ? `<span class="a">${esc(it.artist)}</span>` : "";
        return `<div class="bar-row${it.artist ? " has-art" : ""}">
          <div class="name"><span class="t">${esc(it.title)}</span>${art}</div>
          <div class="val">${it.n}×</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (it.n / max) * 100)}%"></div></div>
        </div>`;
      })
      .join("")}</div>`;
  }

  function personLine(it) {
    const art = it.artist ? `<span class="a">${esc(it.artist)}</span>` : "";
    return `<div class="name"><span class="t">${esc(it.title)}</span>${art}</div>`;
  }

  function renderGeral() {
    if (!GERAL) GERAL = buildGeral();
    const g = GERAL;
    const shown = onceOpen ? g.once : g.once.slice(0, 10);
    const onceRows = shown
      .map(
        (it) => `<div class="once-row">${personLine(it)}<div class="when">${esc(fmtDate(it.when))}</div></div>`
      )
      .join("");
    const baixaRows = g.baixa
      .map(
        (it) => `<div class="baixa-row">${personLine(it)}<div class="when"><span class="times">${it.n}×</span> · ${esc(fmtDate(it.when))} · ${esc(agoLabel(it.when))}</div></div>`
      )
      .join("");
    const more = g.once.length > 10
      ? `<button type="button" class="once-more" data-once-toggle>${onceOpen ? "Ver menos" : "Ver todas"}</button>`
      : "";
    $("#geral").innerHTML = `
      <p class="geral-summary">${g.cultos} cultos · ${g.songs} músicas · ${g.artists} artistas · ${esc(g.years)}</p>
      <div class="geral-grid">
        <div class="card panel">
          <h3>Top 10 músicas</h3>
          ${geralBars(g.topSongs, "songs")}
        </div>
        <div class="card panel">
          <h3>Top 10 artistas</h3>
          ${geralBars(g.topArtists, "artists")}
        </div>
        <div class="card panel span-2">
          <h3>Em baixa</h3>
          <p class="panel-note">Cantadas ao menos 2 vezes, da que está há mais tempo sem voltar</p>
          <div class="baixa-list">${baixaRows || `<p class="empty">Sem dados</p>`}</div>
        </div>
        <div class="card panel span-2" id="onceBlock">
          <div class="panel-head">
            <h3>Tocadas uma vez só</h3>
            <span class="meta">${g.once.length} de ${g.songs} músicas</span>
          </div>
          <div class="once-list">${onceRows || `<p class="empty">Nenhuma música tocada uma vez só</p>`}</div>
          ${more}
        </div>
      </div>`;
  }

  function hashFor(v) {
    return v === "geral" ? "#geral" : `#${v}`;
  }

  function hashRaw() {
    return decodeURIComponent((location.hash || "").replace(/^#/, "")).trim().toLowerCase();
  }

  function parseHash() {
    const raw = hashRaw();
    if (!raw || raw === "geral" || raw === "proximo" || raw === "mes") return "geral";
    if (/^\d{4}$/.test(raw)) {
      const y = Number(raw);
      if ((DATA.anos || []).includes(y)) return y;
    }
    return null;
  }

  function scrollTabIntoView(btn) {
    const scroller = btn.parentElement;
    if (!scroller) return;
    const s = scroller.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    if (b.left < s.left + 4) scroller.scrollLeft -= s.left - b.left + 8;
    else if (b.right > s.right - 4) scroller.scrollLeft += b.right - s.right + 8;
  }

  function syncTabs() {
    $$("#viewTabs button").forEach((b) => {
      const on = b.dataset.view === "geral" ? view === "geral" : Number(b.dataset.view) === view;
      b.setAttribute("aria-pressed", String(on));
      if (on) scrollTabIntoView(b);
    });
  }

  function showView() {
    const searching = query.trim().length >= 2;
    document.body.classList.toggle("is-searching", searching);
    document.body.dataset.view = view === "geral" ? "geral" : "year";
    syncTabs();
    renderSearch();
    if (searching) return;
    if (view === "geral") renderGeral();
    else {
      year = view;
      renderDash();
      renderMonths();
    }
  }

  function setView(next, { updateHash = true } = {}) {
    view = next;
    if (typeof next === "number") year = next;
    showView();
    if (!updateHash) return;
    const hash = hashFor(next);
    if (location.hash !== hash) location.hash = hash;
  }

  function readHash() {
    const parsed = parseHash();
    const raw = hashRaw();
    if (parsed == null || !location.hash || raw === "proximo" || raw === "mes") {
      if (location.hash !== "#geral") history.replaceState(null, "", "#geral");
      setView("geral", { updateHash: false });
      return;
    }
    setView(parsed, { updateHash: false });
  }

  async function init() {
    const res = await fetch("dados.json");
    DATA = await res.json();
    $("#brandTitle").textContent = DATA.titulo;
    const tabs = $("#viewTabs");
    tabs.insertAdjacentHTML(
      "beforeend",
      (DATA.anos || [])
        .map((y) => `<button type="button" role="tab" data-view="${y}" aria-pressed="false">${y}</button>`)
        .join("")
    );
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      const next = btn.dataset.view === "geral" ? "geral" : Number(btn.dataset.view);
      setView(next);
    });
    $("#geral").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-once-toggle]");
      if (!btn) return;
      onceOpen = !onceOpen;
      renderGeral();
    });
    window.addEventListener("hashchange", () => readHash());
    const input = $("#q");
    let t = null;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        query = input.value;
        showView();
      }, 120);
    });
    $("#updated").textContent = DATA.atualizadoEm
      ? `Atualizado em ${DATA.atualizadoEm.replace("T", " ").slice(0, 16)} (America/Sao_Paulo)`
      : "";
    readHash();
  }

  init().catch((err) => {
    document.body.innerHTML = `<p style="padding:2rem;font-family:sans-serif">Erro ao carregar dados: ${esc(err.message)}</p>`;
  });
})();
