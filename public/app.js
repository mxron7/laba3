const $ = id => document.getElementById(id);
import {renderShop} from './shop.js';
const pages = ['home','catalog','profile','ranking','player','mail','donate'];
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
  result.classList.remove('revealed','dealing');
  $('pickTitle').textContent = 'Выбери один листок';
  $('drawStatus').textContent = '';
  reading.hidden = true;
  for (const lot of lots) {
    lot.disabled = false;
    lot.classList.remove('chosen');
    lot.querySelector('.face').textContent = '';
  }
}

function offerSlips() {
  result.classList.add('dealing');
  for (const lot of lots) lot.disabled = false;
  lots[0].focus();
}

function showHeroSlip(sign, title) {
  const art = document.querySelector('.art');
  const paper = art.querySelector('.front');
  art.querySelector('.back').hidden = true;
  paper.querySelector('strong').textContent = sign;
  paper.querySelector('small').textContent = title;
  Object.assign(paper.querySelector('small').style, {
    fontSize: 'clamp(14px, 1.6vw, 23px)', letterSpacing: 'normal', textAlign: 'center'
  });
  Object.assign(paper.style, {
    left: '50%', top: '14%', width: '33%', maxWidth: '180px',
    transform: 'translateX(-50%) rotate(5deg)'
  });
  art.removeAttribute('aria-hidden');
  art.setAttribute('role', 'img');
  art.setAttribute('aria-label', 'Твой листок — ' + title);
}

drawReady
  .then(account => account?.saved())
  .then(saved => {
    if (saved && outcomes[saved.outcome]) {
      const [sign,title] = outcomes[saved.outcome];
      showHeroSlip(sign, title);
    }
  })
  .catch(() => {});

function reveal(lot, {outcome,reward}, saved = false) {
  lastTrial = outcome;
  const [sign,title,message] = outcomes[outcome];
  if (reward != null) showHeroSlip(sign, title);  
  lot.querySelector('.face').textContent = sign;
  $('fortune').textContent = title;
  $('advice').textContent = message;
  $('reward').textContent = reward == null ? 'Пробный листок · без начисления' : 'Удача за сегодня: +' + reward;
  $('drawStatus').textContent = saved ? 'Следующий ежедневный листок — после полуночи по Владивостоку.' : '';
  $('pickTitle').textContent = saved ? 'Твой листок на сегодня' : 'Твой листок';
  result.classList.remove('dealing');
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
    offerSlips();
  } catch {
    if (result.open && round === ticket) $('drawStatus').textContent = 'Не удалось проверить листок. Закрой окно и попробуй снова.';
  }
};
$('tryLot').onclick = () => {
  resetPicker();
  trial = true;
  $('pickTitle').textContent = 'Выбери пробный листок';
  offerSlips();
};

for (const lot of lots) {
  lot.onclick = async () => {
    if (trial) {
      for (const item of lots) item.disabled = true;
      reveal(lot, guestDraw());
      return;
    }
    const ticket = round;
    for (const item of lots) item.disabled = true;
    $('drawStatus').textContent = 'Открываем листок…';
    try {
      const account = await drawReady;
      if (!result.open || ticket !== round) return;
      const drawn = await account?.draw() ?? guestDraw();
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
void renderShop();
