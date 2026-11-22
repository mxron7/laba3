import {url,key} from './config.js';

export async function setupAccount(showDraw, guestDraw) {
  const panel = document.getElementById('profileBody');
  const draw = document.getElementById('draw');
  const status = document.getElementById('status');
  if (!url || !key) {
    panel.innerHTML = '<h2>Гостевой доступ</h2><p>Пока сад открыт для знакомства. Попробуй листок омикудзи или посмотри коллекцию талисманов.</p><a class="login" href="#home">К омикудзи</a>';
    return;
  }
  const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm');
  const db = createClient(url,key);
  let current = null;
  let registering = false;
  function form() {
    panel.innerHTML = `<h2>${registering?'Регистрация':'Вход'}</h2><form>
    ${registering?'<label>Имя<input name="nickname" maxlength="32" required></label>':''}
    <label>Почта<input type="email" name="email" autocomplete="email" required></label>
    <label>Пароль<input type="password" name="password" autocomplete="${registering?'new-password':'current-password'}" minlength="6" required></label>
    <button>${registering?'Создать профиль':'Войти'}</button>
    <button type="button" class="secondary">${registering?'Уже есть аккаунт':'Зарегистрироваться'}</button></form>`;
    panel.querySelector('.secondary').onclick = () => {registering = !registering; form();};
    panel.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const button = event.currentTarget.querySelector('button');
      button.disabled = true;
      const credentials = {email:fields.get('email'),password:fields.get('password')};
      try {
        const {data,error} = registering
          ? await db.auth.signUp({...credentials,options:{data:{name:fields.get('nickname')}}})
          : await db.auth.signInWithPassword(credentials);
        if (error) throw error;
        status.textContent = data.session ? '' : 'Проверь почту для подтверждения регистрации.';
      } catch (error) {status.textContent = error.message;}
      finally {button.disabled = false;}
    };
  }
  async function profile(user) {
    const {data,error} = await db.from('users').select('name,luck_balance,coin_balance').eq('id',user.id).single();
    if (user !== current) return;
    if (error) {status.textContent = error.message;return;}
    panel.innerHTML = '<h2></h2><p></p><button>Выйти</button>';
    panel.querySelector('h2').textContent = data.name;
    panel.querySelector('p').textContent = 'Удача: ' + data.luck_balance + ' · Монеты: ' + data.coin_balance;
    panel.querySelector('button').onclick = async () => {
      const {error} = await db.auth.signOut();
      if (error) status.textContent = error.message;
    };
  }
  draw.disabled = true;
  db.auth.onAuthStateChange((_event, session) => {
    current = session?.user ?? null;
    document.getElementById('account').textContent = current ? 'Мой профиль' : 'Войти';
    draw.disabled = false;
    if (current) {const user = current; setTimeout(() => profile(user),0);}
    else form();
  });
  draw.onclick = async () => {
    if (!current) return guestDraw();
    draw.disabled = true;
    try {
      const {data,error} = await db.rpc('draw_today');
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      showDraw(result.outcome,result.reward);
      if (current) await profile(current);
    } catch (error) {status.textContent = error.message;}
    finally {draw.disabled = false;}
  };
}
