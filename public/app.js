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
