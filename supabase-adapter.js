(function () {
  'use strict';

  var PROJECT_URL = 'https://weklmapqizeldfdalbgs.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_cFm2Jvj2jvFyKcxbGniVWw_PL2SL7HC';
  var FUNCTIONS_URL = PROJECT_URL + '/functions/v1';

  if (window.location.pathname.indexOf('/r/') === 0) {
    var shortCode = window.location.pathname.split('/').filter(Boolean)[1] || '';
    if (shortCode) window.location.hash = '#/refleksi/' + encodeURIComponent(shortCode);
  }

  var sb = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  window.etosSupabase = sb;

  function fetchJson(url, options) {
    options = options || {};
    options.headers = Object.assign({
      'Content-Type': 'application/json',
      'apikey': PUBLISHABLE_KEY
    }, options.headers || {});
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok && !body.error) body.error = 'HTTP ' + response.status;
        return body;
      });
    });
  }

  function publicCall(name, params) {
    return fetchJson(FUNCTIONS_URL + '/public-api', {
      method: 'POST',
      body: JSON.stringify({ function: name, params: params == null ? null : params })
    });
  }

  function reflectionCall(name, params) {
    var action = name === 'getPublicKajianReflectionForm' ? 'form'
      : name === 'verifyKajianReflectionParticipant' ? 'verify'
      : 'submit';
    var payload = Object.assign({}, params || {}, { action: action });
    if (name === 'getPublicKajianReflectionForm') payload.formToken = params;
    return fetchJson(FUNCTIONS_URL + '/public-reflection', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  function secureCall(name, params) {
    if (!sb) return Promise.resolve({ success: false, error: 'Supabase client tidak tersedia.' });
    return sb.auth.getSession().then(function (res) {
      var token = res && res.data && res.data.session ? res.data.session.access_token : '';
      if (!token) return { success: false, error: 'Silakan login sebagai Admin/Fasilitator untuk membuka fitur ini.' };
      return fetchJson('/api/secure', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ function: name, params: params == null ? null : params })
      });
    });
  }

  var PUBLIC_FUNCTIONS = {
    getDashboardStats: 1,
    getFeaturedAwardees: 1,
    getAwardeeList: 1,
    getAlumniList: 1,
    getAkademikList: 1,
    getPrestasiList: 1,
    getOrganisasiList: 1,
    getAwardeeProfile: 1,
    getDropdownOptions: 1
  };
  var REFLECTION_FUNCTIONS = {
    getPublicKajianReflectionForm: 1,
    verifyKajianReflectionParticipant: 1,
    submitKajianReflection: 1
  };

  function invoke(name, args) {
    var params = args && args.length ? args[0] : null;
    if (REFLECTION_FUNCTIONS[name]) return reflectionCall(name, params);
    if (PUBLIC_FUNCTIONS[name]) return publicCall(name, params);
    if (name === 'logoutAbsensiAdmin' || name === 'logoutFacilitatorAccess') return Promise.resolve({ success: true });
    return secureCall(name, params);
  }

  function createRunner() {
    var successHandler = null;
    var failureHandler = null;
    var target = {
      withSuccessHandler: function (handler) { successHandler = handler; return proxy; },
      withFailureHandler: function (handler) { failureHandler = handler; return proxy; }
    };
    var proxy = new Proxy(target, {
      get: function (obj, prop) {
        if (prop in obj) return obj[prop];
        return function () {
          var args = Array.prototype.slice.call(arguments);
          invoke(String(prop), args).then(function (result) {
            if (result && result.success === false) {
              if (successHandler) successHandler(result);
              else if (failureHandler) failureHandler(new Error(result.error || 'Permintaan gagal.'));
              return;
            }
            if (successHandler) successHandler(result);
          }).catch(function (error) {
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
    get: function () { return createRunner(); }
  });

  window.etosApi = {
    call: function (name, params) { return invoke(name, [params]); },
    publicCall: publicCall,
    secureCall: secureCall,
    reflectionCall: reflectionCall
  };

  window.etosAuth = {
    getSession: function () { return sb ? sb.auth.getSession() : Promise.resolve({ data: { session: null } }); },
    signIn: function (email, password) {
      if (!sb) return Promise.reject(new Error('Supabase client tidak tersedia.'));
      return sb.auth.signInWithPassword({ email: email, password: password });
    },
    signOut: function () { return sb ? sb.auth.signOut() : Promise.resolve(); },
    onAuthStateChange: function (callback) { return sb ? sb.auth.onAuthStateChange(callback) : null; },
    bootstrapAdmin: function () {
      if (!sb) return Promise.reject(new Error('Supabase client tidak tersedia.'));
      return sb.auth.getSession().then(function (res) {
        var token = res.data.session && res.data.session.access_token;
        if (!token) throw new Error('Sesi login diperlukan.');
        return fetchJson(FUNCTIONS_URL + '/bootstrap-admin', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: '{}'
        });
      });
    }
  };
})();
