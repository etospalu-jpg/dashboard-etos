(function () {
  'use strict';

  const PROJECT_URL = 'https://weklmapqizeldfdalbgs.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
  const FUNCTIONS_URL = PROJECT_URL + '/functions/v1';
  const INTERNAL_AUTH_EMAIL = 'shadiqalfatih2@gmail.com';
  // SHA-256 only prevents the PIN from being printed in source. Supabase Auth still provides server-side rate limiting.
  const EXPECTED_PIN_SHA256 = 'e811d29b1b60cc0f4ffc2e65ffc4b14c38415da9c7b1cc73f73a97c67725a490';

  const sb = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  window.etosSupabase = sb;

  async function sha256(text) {
    const bytes = new TextEncoder().encode(String(text || ''));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function fetchJson(url, options) {
    options = options || {};
    options.headers = Object.assign({
      'Content-Type': 'application/json',
      'apikey': PUBLISHABLE_KEY
    }, options.headers || {});
    const response = await fetch(url, options);
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok && !body.error) body.error = 'HTTP ' + response.status;
    return body;
  }

  function publicCall(name, params) {
    return fetchJson(FUNCTIONS_URL + '/public-api', {
      method: 'POST',
      body: JSON.stringify({ function: name, params: params == null ? null : params })
    });
  }

  function reflectionCall(name, params) {
    const action = name === 'getPublicKajianReflectionForm' ? 'form'
      : name === 'verifyKajianReflectionParticipant' ? 'verify'
      : 'submit';
    const payload = Object.assign({}, params || {}, { action });
    if (name === 'getPublicKajianReflectionForm') payload.formToken = params;
    return fetchJson(FUNCTIONS_URL + '/public-reflection', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async function secureCall(name, params) {
    if (!sb) return { success: false, error: 'Supabase client tidak tersedia.' };
    const { data } = await sb.auth.getSession();
    const token = data && data.session ? data.session.access_token : '';
    if (!token) return { success: false, error: 'PIN akses diperlukan untuk fitur operasional.' };
    return fetchJson('/api/secure', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ function: name, params: params == null ? null : params })
    });
  }

  const PUBLIC_FUNCTIONS = new Set([
    'getDashboardStats','getFeaturedAwardees','getAwardeeList','getAlumniList',
    'getAkademikList','getPrestasiList','getOrganisasiList','getAwardeeProfile','getDropdownOptions'
  ]);
  const REFLECTION_FUNCTIONS = new Set([
    'getPublicKajianReflectionForm','verifyKajianReflectionParticipant','submitKajianReflection'
  ]);

  async function call(name, params) {
    if (REFLECTION_FUNCTIONS.has(name)) return reflectionCall(name, params);
    if (PUBLIC_FUNCTIONS.has(name)) return publicCall(name, params);
    if (name === 'logoutAbsensiAdmin' || name === 'logoutFacilitatorAccess') return { success: true };
    return secureCall(name, params);
  }

  async function bootstrapAdmin() {
    if (!sb) throw new Error('Supabase client tidak tersedia.');
    const { data } = await sb.auth.getSession();
    const token = data && data.session ? data.session.access_token : '';
    if (!token) return null;
    return fetchJson(FUNCTIONS_URL + '/bootstrap-admin', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: '{}'
    });
  }

  async function signInPin(pin) {
    if (!sb) throw new Error('Supabase client tidak tersedia.');
    pin = String(pin || '').trim();
    if (!/^\d{6}$/.test(pin)) throw new Error('PIN harus terdiri dari 6 digit.');
    if ((await sha256(pin)) !== EXPECTED_PIN_SHA256) throw new Error('PIN tidak sesuai.');

    let result = await sb.auth.signInWithPassword({ email: INTERNAL_AUTH_EMAIL, password: pin });
    if (!result.error && result.data && result.data.session) {
      try { await bootstrapAdmin(); } catch (_) {}
      return { session: result.data.session, firstSetup: false };
    }

    const signup = await sb.auth.signUp({
      email: INTERNAL_AUTH_EMAIL,
      password: pin,
      options: { data: { full_name: 'Administrator ETOS Palu' } }
    });
    if (signup.error) throw signup.error;
    if (signup.data && signup.data.session) {
      try { await bootstrapAdmin(); } catch (_) {}
      return { session: signup.data.session, firstSetup: true };
    }
    return {
      session: null,
      firstSetup: true,
      needsConfirmation: true,
      message: 'Aktivasi pertama dibuat. Konfirmasi akun fasilitator sekali, lalu masuk kembali menggunakan PIN yang sama.'
    };
  }

  function createRunner() {
    let successHandler = null;
    let failureHandler = null;
    const target = {
      withSuccessHandler(handler) { successHandler = handler; return proxy; },
      withFailureHandler(handler) { failureHandler = handler; return proxy; }
    };
    const proxy = new Proxy(target, {
      get(obj, prop) {
        if (prop in obj) return obj[prop];
        return function () {
          const args = Array.prototype.slice.call(arguments);
          call(String(prop), args.length ? args[0] : null).then(result => {
            if (successHandler) successHandler(result);
          }).catch(error => {
            if (failureHandler) failureHandler(error);
            else console.error('[ETOS Supabase Adapter]', prop, error);
          });
          return proxy;
        };
      }
    });
    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: true,
    get() { return createRunner(); }
  });

  window.etosAPI = { call, publicCall, secureCall, reflectionCall };
  window.etosAuth = {
    signInPin,
    bootstrapAdmin,
    getSession() { return sb ? sb.auth.getSession() : Promise.resolve({ data: { session: null } }); },
    signOut() { return sb ? sb.auth.signOut() : Promise.resolve(); },
    onChange(callback) { return sb ? sb.auth.onAuthStateChange(callback) : null; }
  };
})();
