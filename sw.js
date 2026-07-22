// Camp board service worker — offline app shell with NETWORK-FIRST freshness.
// The newest deployed page always wins when there's signal; the cache is only
// the offline fallback. This preserves the board's freshness contract: the SW
// never serves a stale page in place of a reachable newer one.
var APP_VERSION="2027.8"; // keep in step with version.json on each deploy
var CACHE="kyarng27-shell-"+APP_VERSION;
var SHELL=["index.html","psg.html","medic.html","command.html","dc.html","synccheck.html","version.json"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(SHELL.map(function(u){
        return fetch(u,{cache:"no-store"}).then(function(r){ if(r.ok) return c.put(u,r); }).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k.indexOf("kyarng27-shell-")===0 && k!==CACHE; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function(e){
  var req=e.request;
  if(req.method!=="GET") return;
  var url=new URL(req.url);
  if(url.origin!==location.origin) return; // sync/weather calls go straight to the network, untouched
  e.respondWith(
    fetch(req,{cache:"no-store"}).then(function(r){
      if(r&&r.ok){ var copy=r.clone(); caches.open(CACHE).then(function(c){ c.put(url.pathname,copy); }).catch(function(){}); }
      return r;
    }).catch(function(){
      // offline: serve the cached shell (ignore ?sync=/?u= query variants)
      return caches.match(url.pathname,{ignoreSearch:true}).then(function(hit){
        return hit||caches.match(req,{ignoreSearch:true});
      });
    })
  );
});
