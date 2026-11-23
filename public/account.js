import {renderCard,communityRoutes} from './community.js';
import {renderShop} from './shop.js';
import {setupPost} from './post.js';
import {url,key} from './config.js';

export async function setupAccount() {
  const panel = document.getElementById('profileBody');
  const draw = document.getElementById('draw');
  const status = document.getElementById('status');
  if (!url || !key) {
    panel.innerHTML = '<h2>Гостевой доступ</h2><p>Пока сад открыт для знакомства. Попробуй листок омикудзи или посмотри коллекцию талисманов.</p><a class="login" href="#home">К омикудзи</a>';
    return null;
  }
  const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm');
  const db = createClient(url,key);
  communityRoutes(db);
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
    try {
      await renderCard(db,panel,user.id,true,()=>current===user);
    } catch {
      if (current===user) panel.textContent = 'Не удалось загрузить профиль. Обнови страницу.';
    }
  }
  const updatePost = setupPost(db, () => { if (current) void profile(current); });
  function refreshShop() {
    const user = current;
    void renderShop(user && db, () => { if (current?.id === user?.id) void profile(current); });
  }
  window.addEventListener('hashchange', () => { if (location.hash === '#catalog') refreshShop(); });
  draw.disabled = true;
  let initialized;
  const initialSession = new Promise(resolve => { initialized = resolve; });
  db.auth.onAuthStateChange((_event, session) => {
    current = session?.user ?? null;
    setTimeout(() => { updatePost(current?.id ?? null); refreshShop(); },0);
    initialized();
    document.getElementById('account').hidden = Boolean(current);
    document.getElementById('profileLink').hidden = !current;
    draw.disabled = false;
    if (current) {const user = current; setTimeout(() => profile(user),0);}
    else form();
  });
  await initialSession;
  const calendar = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Vladivostok'});
  let cachedSlip;
  return {
    async saved() {
      if (!current) return null;
      const user = current;
      const day = calendar.format(new Date());
      if (cachedSlip?.userId === user.id && cachedSlip.day === day) return cachedSlip.value;
      const {data,error} = await db.from('omikuji_draws').select('outcome,reward')
        .eq('user_id',user.id).eq('day',day).maybeSingle();
      if (error || current?.id !== user.id) throw new Error('Не удалось проверить листок.');
      if (data) cachedSlip = {userId:user.id, day, value:data};
      return data;
    },
    async draw() {
      if (!current) return null;
      const user = current;
      const {data,error} = await db.rpc('draw_today');
      if (error || current?.id !== user.id) throw new Error('Не удалось открыть листок.');
      void profile(user);
      const value = Array.isArray(data) ? data[0] : data;
      cachedSlip = {userId:user.id, day:value.day, value};
      return value;
    }
  };
}
