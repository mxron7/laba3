const byId = id => document.getElementById(id);
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function profileLink(id, name) {
  const link = element('a',name);
  link.href = '#player/' + id;
  return link;
}

export function setupPost(db, refreshProfile) {
  let viewer, target, cursor, inboxVersion = 0, searchVersion = 0;
  let giftRequest, paymentRequest;
  const gift = byId('giftForm'), payment = byId('payForm');
  async function rpc(name,args) {
    const {data,error} = await db.rpc(name,args);
    if (error) throw error;
    return data;
  }
  async function inbox(append = false) {
    const version = ++inboxVersion;
    if (!viewer || location.hash !== '#mail') return;
    if (!append) {
      cursor = null;
      byId('letters').replaceChildren();
    }
    byId('older').hidden = true;
    byId('inboxStatus').textContent = 'Загрузка…';
    try {
      const rows = await rpc('incoming_envelopes',{before_id:cursor});
      if (version !== inboxVersion) return;
      for (const row of rows) {
        const card = element('article','');
        card.className = 'letter';
        const date = new Date(row.sent_at).toLocaleString('ru-RU');
        card.append(profileLink(row.sender_id,row.nickname),element('p','+' + row.amount + ' удачи'));
        if (row.note) card.append(element('p',row.note));
        card.append(element('small',date));
        byId('letters').append(card);
        cursor = row.id;
      }
      byId('inboxStatus').textContent = cursor ? '' : 'Пока нет конвертов.';
      byId('older').hidden = rows.length < 25;
    } catch {
      if (version !== inboxVersion) return;
      byId('inboxStatus').textContent = 'Не удалось получить почту.';
      byId('older').hidden = false;
    }
  }
  byId('older').onclick = () => inbox(true);
  window.addEventListener('hashchange',() => inbox());
  byId('searchForm').onsubmit = async event => {
    event.preventDefault();
    const version = ++searchVersion;
    target = null;
    gift.hidden = true;
    byId('giftStatus').textContent = '';
    const matches = byId('matches');
    matches.textContent = 'Ищем…';
    try {
      const rows = await rpc('find_players',{term:byId('searchTerm').value.trim()});
      if (version !== searchVersion) return;
      matches.textContent = rows.length ? '' : 'Никого не нашли.';
      for (const row of rows) {
        const line = element('div','');
        line.className = 'person-row';
        const select = element('button','Выбрать');
        select.onclick = () => {
          target = row.player;
          byId('recipientName').textContent = 'Кому — ' + row.nickname;
          gift.hidden = false;
          byId('giftAmount').focus();
        };
        line.append(profileLink(row.player,row.nickname),select);
        matches.append(line);
      }
    } catch {
      if (version === searchVersion) matches.textContent = 'Не удалось выполнить поиск.';
    }
  };
  // Keep the same request ID on a retry after a lost response.
  function request(previous, args) {
    const signature = JSON.stringify(args);
    if (previous?.signature === signature) return previous;
    return {signature, token:crypto.randomUUID()};
  }
  gift.onsubmit = async event => {
    event.preventDefault();
    if (!target || !viewer) return;
    const owner = viewer;
    const args = {target,quantity:Number(byId('giftAmount').value),message:byId('giftNote').value.trim()};
    giftRequest = request(giftRequest,args);
    const button = gift.querySelector('button');
    if (button.disabled) return;
    button.disabled = true;
    try {
      await rpc('send_envelope',{...args,token:giftRequest.token});
      if (viewer !== owner) return;
      giftRequest = null;
      gift.reset();
      byId('giftStatus').textContent = 'Конверт доставлен. Удача уже у получателя.';
      refreshProfile();
    } catch (error) {
      if (viewer === owner) byId('giftStatus').textContent = error.message || 'Не удалось отправить конверт.';
    } finally { if (viewer === owner) button.disabled = false; }
  };
  const number = byId('demoNumber'), expiry = byId('demoExpiry'), code = byId('demoCode');
  const fields = byId('payFields'), payStatus = byId('payStatus');
  number.oninput = () => {
    number.value = number.value.replace(/\D/g,'').slice(0,16).replace(/(\d{4})(?=\d)/g,'$1 ');
    number.setCustomValidity('');
  };
  expiry.oninput = () => {
    expiry.value = expiry.value.replace(/\D/g,'').slice(0,4).replace(/^(\d{2})(\d+)/,'$1/$2');
    expiry.setCustomValidity('');
  };
  code.oninput = () => code.setCustomValidity('');
  let checkoutVisit = 0;
  window.addEventListener('hashchange',() => {
    checkoutVisit++;
    if (location.hash !== '#donate') {
      payment.reset();
      for (const input of [number,expiry,code]) input.setCustomValidity('');
      payStatus.textContent = '';
    }
  });
  payment.onsubmit = async event => {
    event.preventDefault();
    if (!viewer || fields.disabled) return;
    number.setCustomValidity(/^\d{16}$/.test(number.value.replace(/ /g,'')) ? '' : 'Введи 16 цифр.');
    const date = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry.value);
    const validUntil = date && new Date(2000 + Number(date[2]), Number(date[1]), 1);
    expiry.setCustomValidity(validUntil && validUntil > new Date() ? '' : 'Укажи текущий или будущий месяц в формате ММ/ГГ.');
    code.setCustomValidity(/^\d{3}$/.test(code.value) ? '' : 'Введи три цифры CVC.');
    if (!payment.reportValidity()) return;
    const owner = viewer, visit = checkoutVisit;
    const coins = Number(byId('package').value);
    fields.disabled = true;
    payStatus.textContent = 'Проверяем тестовую оплату…';
    paymentRequest = request(paymentRequest,{coins});
    try {
      await Promise.all([
        rpc('demo_top_up',{coins,token:paymentRequest.token}),
        new Promise(resolve => setTimeout(resolve,700))
      ]);
      if (viewer !== owner) return;
      paymentRequest = null;
      refreshProfile();
      if (visit !== checkoutVisit) return;
      payment.reset();
      payStatus.textContent = 'Оплачено · +' + coins + ' монет. Возвращаемся в профиль…';
      await new Promise(resolve => setTimeout(resolve,1200));
      if (viewer === owner && visit === checkoutVisit) location.hash = 'profile';
    } catch {
      if (viewer === owner && visit === checkoutVisit) payStatus.textContent = 'Не удалось подтвердить оплату. Попробуй ещё раз.';
    } finally { if (viewer === owner) fields.disabled = false; }
  };
  return id => {
    if (id === viewer) return;
    viewer = id;
    checkoutVisit++;
    fields.disabled = false;
    for (const input of [number,expiry,code]) input.setCustomValidity('');
    searchVersion++;
    target = giftRequest = paymentRequest = null;
    for (const key of ['matches','letters','giftStatus','inboxStatus','payStatus']) byId(key).replaceChildren();
    byId('searchForm').reset();
    gift.reset();
    payment.reset();
    gift.hidden = true;
    gift.querySelector('button').disabled = payment.querySelector('button').disabled = false;
    byId('mailGate').hidden = byId('payGate').hidden = Boolean(id);
    byId('mailTools').hidden = payment.hidden = !id;
    void inbox();
  };
}
