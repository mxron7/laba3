import {catalog,talismanImage} from './community.js';

let version = 0;
export async function renderShop(db, onPurchase) {
  const view = ++version;
  const panel = document.getElementById('cards');
  try {
    const [items, offers] = await Promise.all([catalog, db ? db.rpc('shop_offers') : null]);
    if (view !== version) return;
    if (offers?.error) throw offers.error;
    panel.replaceChildren();
    for (const [id,,name,rarity,basePrice,meaning,effect] of items) {
      const offer = offers?.data?.find(row => row.item === id);
      const card = document.createElement('article');
      card.append(talismanImage(id));
      for (const [tag,text] of [['small',rarity],['h3',name],['p',meaning],['p',effect]]) {
        const part = document.createElement(tag);
        part.textContent = text;
        card.append(part);
      }
      if (!db) {
        const link = document.createElement('a');
        link.href = '#profile';
        link.textContent = 'Войти для покупки · ' + basePrice + ' монет';
        card.append(link);
      } else {
        const button = document.createElement('button');
        const status = document.createElement('p');
        status.setAttribute('role','status');
        button.disabled = !offer || offer.owned;
        button.textContent = !offer ? 'Недоступно' : offer.owned ? 'Куплено' : 'Купить за ' + offer.cost + ' монет';
        button.onclick = async () => {
          button.disabled = true;
          try {
            const {error} = await db.rpc('buy_talisman',{chosen:id});
            if (error) throw error;
            if (view !== version) return;
            button.textContent = 'Куплено';
            status.textContent = 'Теперь талисман можно закрепить в профиле.';
            onPurchase();
          } catch (error) {
            button.disabled = false;
            status.textContent = error.message || 'Не удалось купить талисман.';
          }
        };
        card.append(button,status);
      }
      panel.append(card);
    }
  } catch {
    if (view === version) panel.textContent = 'Не удалось загрузить магазин. Обнови страницу.';
  }
}
