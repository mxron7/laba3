const $ = id => document.getElementById(id);
const pages = ['home','catalog','profile'];
function route() {
  const page = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  for (const id of pages) $(id).hidden = page !== id;
  for (const link of document.querySelectorAll('.links a')) {
    if (link.hash === '#' + page) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  $('status').textContent = '';
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
route();
const outcomes = {
  great:['大吉','Большая удача','Смело берись за дело, которое давно откладывал.'],
  good:['吉','Хорошая удача','Сегодня хороший повод написать старому другу.'],
  small:['小吉','Малая удача','Заметь маленькую радость и поделись ею с кем-нибудь.'],
  poor:['凶','Плохая удача','Оставь время на отдых. Завтра тебя ждёт новый листок.']
};
function showDraw(outcome, reward) {
  const [sign,title,message] = outcomes[outcome];
  $('sign').textContent = sign;
  $('fortune').textContent = title;
  $('advice').textContent = message;
  $('reward').textContent = reward == null ? 'Гостевой листок · без начисления удачи' : 'Удача за сегодня: +' + reward;
  $('result').showModal();
}
function guestDraw() {
  const keys = Object.keys(outcomes);
  showDraw(keys[Math.floor(Math.random()*keys.length)]);
}
$('draw').onclick = guestDraw;
import {setupAccount} from './account.js';
setupAccount(showDraw,guestDraw).catch(() => {
  $('profileBody').textContent = 'Сервис входа временно недоступен. Попробуй обновить страницу.';
});
async function loadCatalog() {
  const response = await fetch('./catalog.json');
  if (!response.ok) throw new Error();
  for (const [,symbol,name,rarity,price,meaning,effect] of await response.json()) {
    const card = document.createElement('article');
    for (const [tag,content] of [['b',symbol],['small',rarity+' · '+price+' монет'],['h3',name],['p',meaning],['p',effect]]) {
      const element = document.createElement(tag);
      if (tag === 'b') element.className = 'symbol';
      element.textContent = content;
      card.append(element);
    }
    $('cards').append(card);
  }
}
loadCatalog().catch(() => {$('cards').textContent = 'Не удалось загрузить каталог. Обнови страницу.';});
