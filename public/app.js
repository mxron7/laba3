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
const result = $('result');
const sourcePaper = document.querySelector('.art .front');
const fortuneSlip = result.querySelector('.fortune-slip');
let finishFlight;

function flyFromIllustration() {
  const start = sourcePaper.getBoundingClientRect();
  if (!start.width || !sourcePaper.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const end = fortuneSlip.getBoundingClientRect();
  const dx = start.left + start.width / 2 - end.left - end.width / 2;
  const dy = start.top + start.height / 2 - end.top - end.height / 2;
  const paper = sourcePaper.cloneNode(true);
  paper.classList.add('flying-paper');
  paper.setAttribute('aria-hidden', 'true');
  Object.assign(paper.style, {
    left: (end.left + end.width / 2) + 'px',
    top: (end.top + end.height / 2) + 'px',
    width: sourcePaper.offsetWidth + 'px',
    height: sourcePaper.offsetHeight + 'px'
  });
  result.append(paper);
  sourcePaper.classList.add('drawn');
  result.classList.add('in-flight');

  // Both faces meet edge-on at the destination before the prediction opens.
  const center = 'translate(-50%, -50%)';
  const face = paper.animate([
    {transform: center + ` translate(${dx}px, ${dy}px) rotate(12deg)`},
    {transform: center + ` translate(${dx + 8}px, ${dy - 28}px) rotate(16deg)`, offset: 0.26},
    {transform: center + ' rotate(1deg) rotateY(0deg)', offset: 0.75},
    {transform: center + ' rotateY(90deg)'}
  ], {duration: 740, easing: 'ease-in-out', fill: 'both'});
  const reveal = fortuneSlip.animate([
    {transform: 'rotateY(-90deg) scale(.93)', opacity: 0},
    {transform: 'rotateY(-86deg) scale(.94)', opacity: 1, offset: 0.04},
    {transform: 'rotateY(0deg) scale(1)', opacity: 1}
  ], {delay: 740, duration: 340, easing: 'ease-out', fill: 'both'});
  finishFlight = () => {
    face.cancel();
    reveal.cancel();
    paper.remove();
    result.classList.remove('in-flight');
    finishFlight = undefined;
  };
  reveal.onfinish = () => finishFlight?.();
}

result.addEventListener('close', () => {
  finishFlight?.();
  sourcePaper.classList.remove('drawn');
});
function showDraw(outcome, reward) {
  const [sign,title,message] = outcomes[outcome];
  $('sign').textContent = sign;
  $('fortune').textContent = title;
  $('advice').textContent = message;
  $('reward').textContent = reward == null ? 'Гостевой листок · без начисления удачи' : 'Удача за сегодня: +' + reward;
  if (result.open || $('home').hidden) return;
  result.showModal();
  flyFromIllustration();
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
