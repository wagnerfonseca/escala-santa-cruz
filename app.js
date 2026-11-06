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

  function nextService() {
    const t = todayLocal();
    const all = DATA.meses
      .flatMap((m) => (m.cultos || []).map((c) => ({ ...c, mesId: m.id, mesNome: m.nome })))
      .filter((c) => { const d = parseISO(c.data); return d && d >= t; })
      .sort((a, b) => a.data.localeCompare(b.data));
    return all[0] || null;
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

  function renderBandChips(banda) {
    if (!banda) return `<span class="empty">Banda não informada</span>`;
    const chips = INSTRUMENTS.map(([k, label]) => {
      const who = (banda[k] || "").trim();
      if (!who) return "";
      return `<span class="chip ${INSTRUMENT_CLASS[k]}"><em>${esc(label)}</em>${esc(who)}</span>`;
    }).filter(Boolean);
    return chips.join("") || `<span class="empty">Banda não informada</span>`;
  }

  function renderBandGrid(banda) {
    return INSTRUMENTS.map(([k, label]) => {
      const who = (banda?.[k] || "").trim();
      const empty = !who;
      const cls = empty ? "band-item is-empty" : `band-item ${INSTRUMENT_CLASS[k]}`;
      return `<div class="${cls}"><span class="role">${esc(label)}</span><span class="who">${empty ? "—" : esc(who)}</span></div>`;
    }).join("");
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

  function renderHero() {
    const next = nextService();
    const month = currentMonth();
    const hero = $("#hero");
    if (!next && !month) {
      hero.innerHTML = `<div class="card card-pad"><p class="empty">Nenhum culto encontrado.</p></div>`;
      return;
    }

    const focus = next || (month?.cultos || [])[0];
    const monthBlock = month
      ? `<div class="card card-pad">
          <div class="section-title" style="margin-bottom:.65rem"><h2>Mês atual</h2><span class="meta">${esc(month.nome)}${month.completo ? "" : " · parcial"}</span></div>
          <div class="month-sundays">
            ${(month.cultos || [])
              .map((c) => {
                const active = next && c.data === next.data ? " is-next" : "";
                const obs = isSantaCeia(c.observacao)
                  ? `<span class="badge santa-ceia">${esc(c.observacao)}</span>`
                  : (c.observacao ? `<span class="badge">${esc(c.observacao)}</span>` : "");
                return `<div class="sunday-mini${active}">
                  <header><strong>${esc(fmtDay(c.data))}</strong>${obs}</header>
                  <div class="chips">${renderBandChips(c.banda)}</div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`
      : "";

    const obsBadge = focus.observacao
      ? `<span class="badge ${isSantaCeia(focus.observacao) ? "santa-ceia" : "accent"}">${esc(focus.observacao)}</span>`
      : "";
    hero.innerHTML = `
      <div class="card card-pad hero-next">
        <div class="section-title"><h2>Próximo culto</h2><span class="meta">${esc(focus.mesNome || "")}</span></div>
        <h3>${esc(fmtDay(focus.data))}</h3>
        <div class="badge-row">
          ${obsBadge}
          <span class="badge">Domingo</span>
        </div>
        <div class="band-grid">${renderBandGrid(focus.banda)}</div>
        <div style="margin-top:1rem">
          <div class="section-title"><h2>Repertório</h2></div>
          <div class="songs-list">${renderSongs(focus.musicas)}</div>
        </div>
      </div>
      ${monthBlock}`;
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

  function setYear(y) {
    year = y;
    $$(".year-pills button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.year) === y)));
    renderDash();
    renderMonths();
  }

  function renderAll() {
    renderHero();
    renderDash();
    renderMonths();
    renderSearch();
    const upd = DATA.atualizadoEm ? DATA.atualizadoEm.replace("T", " ").slice(0, 16) : "";
    $("#updated").textContent = upd ? `Atualizado em ${upd} (America/Sao_Paulo)` : "";
  }

  async function init() {
    const res = await fetch("dados.json");
    DATA = await res.json();
    $("#brandTitle").textContent = DATA.titulo;
    const pills = $("#yearPills");
    pills.innerHTML = (DATA.anos || [])
      .map((y) => `<button type="button" data-year="${y}" aria-pressed="${y === year}">${y}</button>`)
      .join("");
    pills.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-year]");
      if (!btn) return;
      setYear(Number(btn.dataset.year));
    });
    const input = $("#q");
    let t = null;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        query = input.value;
        renderSearch();
      }, 120);
    });
    // default year: current year if present, else last
    const cy = todayLocal().getFullYear();
    year = (DATA.anos || []).includes(cy) ? cy : DATA.anos[DATA.anos.length - 1];
    setYear(year);
    renderHero();
    $("#updated").textContent = DATA.atualizadoEm
      ? `Atualizado em ${DATA.atualizadoEm.replace("T", " ").slice(0, 16)} (America/Sao_Paulo)`
      : "";
  }

  init().catch((err) => {
    document.body.innerHTML = `<p style="padding:2rem;font-family:sans-serif">Erro ao carregar dados: ${esc(err.message)}</p>`;
  });
})();
