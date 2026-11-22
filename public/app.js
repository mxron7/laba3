const $ = id => document.getElementById(id);
import {catalog, talismanImage} from './community.js';
const pages = ['home','catalog','profile','ranking','player'];
function route() {
  const section = location.hash.slice(1).split('/')[0];
  const page = pages.includes(section) ? section : 'home';
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
const result = $('result');
const lots = [...result.querySelectorAll('.lot')];
const reading = $('reading');
let round = 0;
let lastTrial;
function guestDraw() {
  const keys = Object.keys(outcomes).filter(key => key !== lastTrial);
  lastTrial = keys[Math.floor(Math.random() * keys.length)];
  return {outcome:lastTrial};
}
import {setupAccount} from './account.js';
const drawReady = setupAccount().catch(() => {
  $('rankingBody').textContent = $('playerBody').textContent = 'Сервис временно недоступен. Обнови страницу.';
  $('profileBody').textContent = 'Сервис входа временно недоступен. Попробуй обновить страницу.';
  $('draw').disabled = false;
  return null;
});

let trial = false;
function resetPicker() {
  round++;
  $('tryLot').hidden = true;
  result.classList.remove('revealed');
  $('pickTitle').textContent = 'Выбери один листок';
  $('drawStatus').textContent = '';
  reading.hidden = true;
  for (const lot of lots) {
    lot.disabled = false;
    lot.classList.remove('chosen');
    lot.querySelector('.face').textContent = '';
  }
}

function reveal(lot, {outcome,reward}, saved = false) {
  lastTrial = outcome;
  const [sign,title,message] = outcomes[outcome];
  lot.querySelector('.face').textContent = sign;
  $('fortune').textContent = title;
  $('advice').textContent = message;
  $('reward').textContent = reward == null ? 'Пробный листок · без начисления' : 'Удача за сегодня: +' + reward;
  $('drawStatus').textContent = saved ? 'Следующий ежедневный листок — после полуночи по Владивостоку.' : '';
  $('pickTitle').textContent = saved ? 'Твой листок на сегодня' : 'Твой листок';
  lot.classList.add('chosen');
  result.classList.add('revealed');
  reading.hidden = false;
  $('tryLot').hidden = false;
  result.querySelector('.close').focus();
}

$('draw').onclick = async () => {
  trial = false;
  resetPicker();
  const ticket = round;
  for (const lot of lots) lot.disabled = true;
  $('drawStatus').textContent = 'Проверяем сегодняшний листок…';
  result.showModal();
  try {
    const account = await drawReady;
    const saved = await account?.saved();
    if (!result.open || round !== ticket) return;
    if (saved) return reveal(lots[0], saved, true);
    $('drawStatus').textContent = '';
    for (const lot of lots) lot.disabled = false;
    lots[0].focus();
  } catch {
    if (result.open && round === ticket) $('drawStatus').textContent = 'Не удалось проверить листок. Закрой окно и попробуй снова.';
  }
};
$('tryLot').onclick = () => {
  resetPicker();
  trial = true;
  $('pickTitle').textContent = 'Выбери пробный листок';
  lots[0].focus();
};

for (const lot of lots) {
  lot.onclick = async () => {
    const ticket = round;
    for (const item of lots) item.disabled = true;
    $('drawStatus').textContent = 'Открываем листок…';
    try {
      const account = await drawReady;
      if (!result.open || ticket !== round) return;
      const drawn = trial ? guestDraw() : (await account?.draw() ?? guestDraw());
      if (!result.open || ticket !== round) return;
      reveal(lot, drawn);
    } catch {
      if (!result.open || ticket !== round) return;
      $('drawStatus').textContent = 'Не удалось открыть листок. Выбери ещё раз.';
      for (const item of lots) item.disabled = false;
      lot.focus();
    }
  };
}
async function loadCatalog() {
  for (const [id,,name,rarity,price,meaning,effect] of await catalog) {
    const card = document.createElement('article');
    card.append(talismanImage(id));
    for (const [tag,content] of [['small',rarity+' · '+price+' монет'],['h3',name],['p',meaning],['p',effect]]) {
      const element = document.createElement(tag);
      element.textContent = content;
      card.append(element);
    }
    $('cards').append(card);
  }
}
loadCatalog().catch(() => {$('cards').textContent = 'Не удалось загрузить каталог. Обнови страницу.';});
