const GAME_COLORS = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#f97316','#06b6d4'];

const state = {
  locale: 'ko-KR',
  t: {},
  pokedex: { games: [], pokemon: [] },
  encounters: { encounters: {} },
  selectedDexNo: null
};

const refs = {
  appTitle: q('#appTitle'), appSubtitle: q('#appSubtitle'),
  labelViewMode: q('#labelViewMode'), labelGeneration: q('#labelGeneration'), labelSeries: q('#labelSeries'),
  viewMode: q('#viewMode'), generationSelect: q('#generationSelect'), seriesSelect: q('#seriesSelect'),
  searchInput: q('#searchInput'), listTitle: q('#listTitle'), detailTitle: q('#detailTitle'), captureTitle: q('#captureTitle'),
  gameLegend: q('#gameLegend'), pokemonList: q('#pokemonList'), pokemonDetail: q('#pokemonDetail'), captureDetail: q('#captureDetail'),
  tpl: q('#pokemonItemTpl')
};

function q(s){return document.querySelector(s)}
const tr = (k) => state.t[k] || k;

async function loadJson(path){ const r = await fetch(path); if(!r.ok) throw new Error(path); return r.json(); }
async function boot(){
  [state.t, state.pokedex, state.encounters] = await Promise.all([
    loadJson('./i18n/ko-KR.json'),
    loadJson('./data/generated/pokedex.json'),
    loadJson('./data/generated/encounters.json')
  ]);
  mountTexts();
  initControls();
  bind();
  render();
}

function mountTexts(){
  refs.appTitle.textContent = tr('appTitle'); refs.appSubtitle.textContent = tr('appSubtitle');
  refs.labelViewMode.textContent = tr('viewMode'); refs.labelGeneration.textContent = tr('generation'); refs.labelSeries.textContent = tr('series');
  refs.listTitle.textContent = tr('pokemonList'); refs.detailTitle.textContent = tr('dexInfo'); refs.captureTitle.textContent = tr('captureInfo');
  refs.searchInput.placeholder = tr('searchPlaceholder');
  refs.pokemonDetail.textContent = tr('selectPrompt'); refs.captureDetail.textContent = tr('capturePrompt');
}

function initControls(){
  refs.viewMode.innerHTML = `<option value="generation">${tr('modeGeneration')}</option><option value="series">${tr('modeSeries')}</option>`;
  const gens = [...new Set(state.pokedex.games.map(g=>g.generation))].sort((a,b)=>a-b);
  refs.generationSelect.innerHTML = gens.map(g=>`<option value="${g}">${g}세대</option>`).join('');
  refs.seriesSelect.innerHTML = state.pokedex.games.map(g=>`<option value="${g.versionGroupId}">${g.label}</option>`).join('');
}

function bind(){
  refs.viewMode.onchange = render; refs.generationSelect.onchange = render; refs.seriesSelect.onchange = render; refs.searchInput.oninput = render;
}

function selectedGroups(){
  if(refs.viewMode.value === 'generation'){
    return state.pokedex.games.filter(g=>g.generation===Number(refs.generationSelect.value));
  }
  return state.pokedex.games.filter(g=>g.versionGroupId===refs.seriesSelect.value);
}

function encounterByPokemon(dexNo){ return state.encounters.encounters[String(dexNo)]?.versionGroups || {}; }
function getPokemon(dexNo){ return state.pokedex.pokemon.find(p=>p.dexNo===dexNo); }

function render(){
  const groups = selectedGroups();
  refs.gameLegend.innerHTML = groups.map((g,i)=>badge(g.label,colorOf(g.versionGroupId,i))).join('');
  const query = refs.searchInput.value.trim();
  const list = state.pokedex.pokemon
    .filter(p=>!query || p.nameKo.includes(query))
    .filter(p=>groups.some(g=>encounterByPokemon(p.dexNo)[g.versionGroupId]))
    .sort((a,b)=>a.dexNo-b.dexNo);

  refs.pokemonList.innerHTML = '';
  for(const p of list){
    const node = refs.tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.pokemon-main').textContent = `#${String(p.dexNo).padStart(4,'0')} ${p.nameKo}`;
    node.querySelector('.pokemon-main').onclick = ()=>{ state.selectedDexNo = p.dexNo; renderDetail(); };
    const wrap = node.querySelector('.title-icons');
    groups.forEach((g,i)=>{
      const status = encounterByPokemon(p.dexNo)[g.versionGroupId]?.status;
      if(!status) return;
      const cls = status === 'unknown' ? 'unknown' : '';
      wrap.insertAdjacentHTML('beforeend', `<span class="badge ${cls}" style="background:${colorOf(g.versionGroupId,i)}">${g.label}:${status}</span>`);
    });
    refs.pokemonList.appendChild(node);
  }
  renderDetail();
}

function renderDetail(){
  const p = getPokemon(state.selectedDexNo);
  if(!p){ refs.pokemonDetail.textContent = tr('selectPrompt'); refs.captureDetail.textContent = tr('capturePrompt'); return; }

  const s = p.baseStats;
  refs.pokemonDetail.innerHTML = `
    <div><strong>#${String(p.dexNo).padStart(4,'0')} ${p.nameKo}</strong></div>
    <div>${tr('type')}: ${p.types.join(', ')}</div>
    <div>${tr('ability')}: ${p.abilities.join(', ')}</div>
    <div>${tr('height')}: ${p.heightM}m / ${tr('weight')}: ${p.weightKg}kg</div>
    <div class="stats">
      <div class="stat">HP ${s.hp}</div><div class="stat">공격 ${s.atk}</div><div class="stat">방어 ${s.def}</div>
      <div class="stat">특공 ${s.spa}</div><div class="stat">특방 ${s.spd}</div><div class="stat">스피드 ${s.spe}</div>
    </div>
    ${renderEvolution(p)}
  `;

  const groups = selectedGroups();
  const encounter = encounterByPokemon(p.dexNo);
  refs.captureDetail.innerHTML = groups.map((g,idx)=>renderCaptureBox(g, idx, encounter[g.versionGroupId])).join('') || tr('noCapture');
}

function renderCaptureBox(group, idx, data){
  if(!data) return '';
  const versions = group.versions.map(v=> {
    const row = data.versions?.[v.gameId] || {status:'unknown',locations:[],specialMethods:[]};
    const c = row.status==='unknown' ? '#64748b' : colorOf(group.versionGroupId, idx);
    const methods = row.specialMethods.length ? row.specialMethods.map(m=>badge(m,c)).join('') : '<small>-</small>';
    const locs = row.locations.length ? `<ul>${row.locations.map(l=>`<li>${l}</li>`).join('')}</ul>` : `<small>${tr('captureUnknown')}</small>`;
    return `<div class="version-row"><span class="badge" style="background:${c}">${v.label}:${row.status}</span><span>${methods}</span></div>${locs}`;
  }).join('');
  return `<div class="map-box"><div><strong style="color:${colorOf(group.versionGroupId,idx)}">${group.label}</strong></div><div>${tr('mapText')}</div>${versions}</div>`;
}

function renderEvolution(p){
  const groups = selectedGroups();
  const pivotGroup = groups[0];
  const pre = p.evolution.prev;
  const next = p.evolution.next?.[0] ?? null;

  const preAvailable = pre ? isCatchable(pre, pivotGroup?.versionGroupId) : false;
  const nextAvailable = next ? isCatchable(next, pivotGroup?.versionGroupId) : false;

  return `<div class="evo-row">
    ${evoBtn(pre, tr('preEvolution'), preAvailable)}
    ${evoBtn(next, tr('nextEvolution'), nextAvailable)}
  </div>`;
}

function evoBtn(dexNo, label, glow){
  if(!dexNo) return `<button class="evo-btn disabled" disabled>${label} · ${tr('notAvailable')}</button>`;
  const target = getPokemon(dexNo);
  const cls = `evo-btn ${glow ? 'glow' : ''}`;
  setTimeout(()=>{
    const btn = document.querySelector(`[data-evo='${dexNo}']`);
    if(btn) btn.onclick = ()=>{state.selectedDexNo = dexNo; renderDetail();};
  },0);
  return `<button class="${cls}" data-evo="${dexNo}">${label} · #${String(dexNo).padStart(4,'0')} ${target?.nameKo || ''}</button>`;
}

function isCatchable(dexNo, groupId){
  if(!groupId) return false;
  const status = encounterByPokemon(dexNo)[groupId]?.status;
  return status === 'available';
}

function colorOf(id, idx){
  const i = state.pokedex.games.findIndex(g=>g.versionGroupId===id);
  return GAME_COLORS[(i>=0?i:idx)%GAME_COLORS.length];
}
function badge(text, color){ return `<span class="badge" style="background:${color}">${text}</span>`; }

boot();
