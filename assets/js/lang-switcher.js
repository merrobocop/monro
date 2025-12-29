// assets/js/lang-switcher.js
// Lang switcher: сохраняет выбор в localStorage, подсвечивает флаг,
// перенаправляет на ту же страницу в выбранном языке и делает fallback,
// если страницы нет (перейдёт на /<lang>/index.html).
//
// Подключение: <script src="/assets/js/lang-switcher.js" defer></script>

(function () {
  'use strict';

  // Конфигурация
  const DEFAULT_LANG = 'nl';                      // язык по умолчанию
  const SUPPORTED = ['en', 'nl', 'uk', 'ua'];     // поддерживаемые коды (ua для удобства)
  const STORAGE_KEY = 'site_lang';                // key в localStorage

  // Утилиты
  function normalizeLang(code) {
    if (!code) return DEFAULT_LANG;
    code = code.toLowerCase();
    if (code === 'ua') return 'uk';
    if (code.length > 2) code = code.split('-')[0]; // 'en-US' -> 'en'
    if (SUPPORTED.includes(code)) return (code === 'ua' ? 'uk' : code);
    return DEFAULT_LANG;
  }

  function pickLangFromNavigator() {
    const nav = navigator.language || navigator.userLanguage || '';
    return normalizeLang(nav);
  }

  // Возвращает имя "текущей страницы" (всё после папки языка)
  // Если URL = /en/about.html  -> returns "about.html"
  // Если URL = /about.html     -> returns "about.html"
  // Если URL = /en/            -> returns "index.html"
  function getCurrentPagePath() {
    // убрать ведущий и завершающий '/'
    let path = window.location.pathname || '/';
    if (path === '/' || path === '/index.html') return 'index.html';

    // убираем первый слэш
    if (path.charAt(0) === '/') path = path.slice(1);
    const parts = path.split('/').filter(Boolean); // ['en','about.html'] или ['about.html']

    // если первый сегмент — код языка (supported), удаляем его
    const first = parts[0] ? parts[0].toLowerCase() : '';
    if (SUPPORTED.includes(first) || first === 'ua') {
      parts.shift();
    }

    // собрать оставшуюся часть пути
    const rest = parts.join('/');
    return rest === '' ? 'index.html' : rest;
  }

  // Формирует URL для перехода: /<lang>/<page><search><hash>
  function buildTargetUrl(lang, page) {
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    // гарантируем, что page задан
    if (!page || page.trim() === '') page = 'index.html';
    // если page уже является относительным путём с подпапками — используем как есть
    return `/${lang}/${page}${search}${hash}`;
  }

  // Проверяем существование целевой страницы методом HEAD, возвращает Promise<boolean>
  // В случае ошибок (политика сервера) возвращаем false, и тогда код выполнит fallback.
  async function pageExists(url) {
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      return resp.ok;
    } catch (e) {
      // fetch может быть запрещён на некоторых простых серверах — считать как "неизвестно"
      // вернём false, и сделаем fallback на index.html
      return false;
    }
  }

  // Подсветка активного флага (img.active)
  function markActiveFlag(lang) {
    const flags = document.querySelectorAll('.lang-switcher img[data-lang]');
    if (!flags || flags.length === 0) return;
    flags.forEach(img => {
      const code = normalizeLang(img.dataset.lang);
      if (code === lang) img.classList.add('active');
      else img.classList.remove('active');
    });
  }

  // Инициализация: ставим обработчики
  function initLangSwitcher() {
    const flags = document.querySelectorAll('.lang-switcher img[data-lang]');
    if (!flags || flags.length === 0) return;

    // Определяем начальный язык: сначала из localStorage, иначе по навигатору
    let saved = localStorage.getItem(STORAGE_KEY);
    saved = normalizeLang(saved || '');
    if (!saved || saved === DEFAULT_LANG) {
      // если нет сохранения, попробуем navigator
      const navLang = pickLangFromNavigator();
      saved = navLang || DEFAULT_LANG;
    }

    // Если пользователь на корне сайта — сделать редирект на saved (или на navigator),
    // но не если уже в языковом каталоге (например /en/).
    (function autoRedirectFromRoot() {
      const p = window.location.pathname || '/';
      // если user на корне или на /index.html, то редирект
      if (p === '/' || p === '/index.html') {
        const target = buildTargetUrl(saved, 'index.html');
        // если уже в корне — перенаправляем
        window.location.replace(target);
      }
    })();

    // Подсветить текущий флаг при загрузке
    markActiveFlag(saved);

    // Обработчики клика
    flags.forEach(flag => {
      flag.addEventListener('click', async function (e) {
        const chosenRaw = flag.dataset.lang;
        const chosen = normalizeLang(chosenRaw);
        if (!chosen) return;

        // сохраняем выбор
        try { localStorage.setItem(STORAGE_KEY, chosen); } catch (err) { /* ignore */ }

        // визуально подсвечиваем
        markActiveFlag(chosen);

        // формируем target
        const page = getCurrentPagePath(); // about.html, services.html или index.html
        const target = buildTargetUrl(chosen, page);

        // если целевая страница есть — идём туда, иначе идём на индекс языка
        const exists = await pageExists(target);
        if (exists) {
          window.location.href = target;
        } else {
          // fallback на /<lang>/index.html
          const fallback = buildTargetUrl(chosen, 'index.html');
          window.location.href = fallback;
        }
      }, { passive: true });
    });

    // Если пользователь попал на страницу языка (например /en/about.html),
    // выставим активный флаг по текущему URL (чтобы не зависеть только от localStorage).
    (function markByUrl() {
      const path = (window.location.pathname || '/').toLowerCase();
      // path like /en/about.html
      // извлекаем первый сегмент
      const segments = path.replace(/^\/+|\/+$/g, '').split('/');
      const first = segments[0] || '';
      const normFirst = normalizeLang(first);
      if (SUPPORTED.includes(normFirst)) {
        markActiveFlag(normFirst);
        try { localStorage.setItem(STORAGE_KEY, normFirst); } catch (err) {}
      }
    })();
  }

  // Старт
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangSwitcher);
  } else {
    initLangSwitcher();
  }

})();
