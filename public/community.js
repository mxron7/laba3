export const catalog = fetch('./catalog.json').then(response => {
  if (!response.ok) throw new Error('Не удалось загрузить талисманы.');
  return response.json();
});

export function talismanImage(id) {
  const img = document.createElement('img');
  img.src = './talismans/' + (id === 'ship' ? 'lantern' : id) + '.png';
  img.alt = '';
  img.className = 'charm-image';
  return img;
}

function el(tag, text, css) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (css) node.className = css;
  return node;
}

export async function renderCard(db, panel, userId, owner, isCurrent) {
  const [cardResult, items, balanceResult] = await Promise.all([
    db.rpc('profile_card',{player:userId}).maybeSingle(),
    catalog,
    owner ? db.from('users').select('luck_balance,coin_balance').eq('id',userId).single() : null
  ]);
  if (!isCurrent()) return;
  if (cardResult.error || balanceResult?.error) throw new Error('Не удалось загрузить профиль.');
  const card = cardResult.data;
  if (!card) { panel.textContent = 'Профиль не найден.'; return; }
  const heading = el('div',null,'profile-heading');
  const stamp = el('span','縁','profile-stamp');
  stamp.setAttribute('aria-hidden','true');
  heading.append(stamp,el('h2',card.display_name));
  panel.replaceChildren(heading);
  if (owner) {
    const balances = el('div',null,'balances');
    for (const [label,value] of [['Удача',balanceResult.data.luck_balance],['Монеты',balanceResult.data.coin_balance]]) {
      const field = el('div');
      field.append(el('span',label),el('strong',value));
      balances.append(field);
    }
    panel.append(balances);
  }
  panel.append(el('h3','Закреплённые талисманы'));
  const slots = el('div',null,'pin-grid');
  const note = el('p');
  note.setAttribute('role','status');
  for (let position = 1; position <= 3; position++) {
    const slot = el('div',null,'pin-slot');
    const item = items.find(row=>row[0] === card.pins[position]);
    if (item) slot.append(talismanImage(item[0]),el('strong',item[2]));
    else slot.append(el('span','◇','empty-pin'),el('span','Свободный слот'));
    if (owner) {
      const select = el('select');
      select.setAttribute('aria-label','Талисман в слоте '+position);
      select.add(new Option(item ? 'Снять талисман' : 'Выбрать талисман',''));
      for (const [id,,name] of items) select.add(new Option(name,id));
      select.value = item?.[0] || '';
      select.onchange = async () => {
        for (const field of slots.querySelectorAll('select')) field.disabled = true;
        try {
          const {error} = await db.rpc('set_profile_pin',{position_no:position,item:select.value || null});
          if (error) throw error;
          await renderCard(db,panel,userId,owner,isCurrent);
        } catch {
          note.textContent = 'Не удалось обновить витрину. Попробуй ещё раз.';
          select.value = item?.[0] || '';
        } finally {
          for (const field of slots.querySelectorAll('select')) field.disabled = false;
        }
      };
      slot.append(select);
    }
    slots.append(slot);
  }
  panel.append(slots,note);
  if (owner) {
    const actions = el('div',null,'profile-actions');
    const preview = el('a','Открыть публичный профиль');
    preview.href='#player/'+userId;
    const logout = el('button','Выйти','secondary');
    logout.onclick=async()=>{const {error}=await db.auth.signOut(); if(error) note.textContent='Не удалось выйти.';};
    actions.append(preview,logout);
    panel.append(actions);
  }
}

export function communityRoutes(db) {
  let version = 0;
  async function refresh() {
    const ticket = ++version;
    const [page,id] = location.hash.slice(1).split('/');
    if (!['ranking','player'].includes(page)) return;
    const panel = document.getElementById(page+'Body');
    panel.textContent='Загрузка…';
    try {
      if (page==='player') {
        if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id || '')) {panel.textContent='Профиль не найден.'; return;}
        await renderCard(db,panel,id,false,()=>ticket===version);
        return;
      }
      const {data,error} = await db.rpc('generosity_ranking');
      if (ticket!==version) return;
      if (error) throw error;
      if (!data.length) { panel.replaceChildren(); return; }
      const list = el('ol',null,'ranking-list');
      for (const row of data) {
        const li = el('li');
        const link = el('a',row.display_name);
        link.href='#player/'+row.player;
        li.append(link,el('strong',row.total+' удачи')); list.append(li);
      }
      panel.replaceChildren(list);
    } catch { if (ticket===version) panel.textContent='Не удалось загрузить данные. Обнови страницу.'; }
  }
  window.addEventListener('hashchange',refresh);
  refresh();
}
