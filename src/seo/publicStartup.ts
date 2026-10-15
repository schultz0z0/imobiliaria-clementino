/** A bounded, progressive loading screen. Without scripting the public HTML
 * stays readable; every user agent receives the same document and behavior. */
const startupHead = `<!-- public-startup:start -->
<style id="public-startup-style">
body{margin:0;background:#18181b}
#public-startup{display:none}
html[data-public-boot]{overflow:hidden}
html[data-public-boot] #root{visibility:hidden}
html[data-public-boot] #public-startup{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:#18181b;color:#b6b6ba;font:14px system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
#public-startup img{width:220px;max-width:80vw;height:auto}
#public-startup span{width:32px;height:32px;border:2px solid #ffffff22;border-top-color:#d7b661;border-radius:50%;animation:public-startup-spin .8s linear infinite}
@keyframes public-startup-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#public-startup span{animation:none}}
</style>
<script id="public-startup-guard">
(function(){
  var root=document.documentElement;
  var timer;
  function finish(){
    root.removeAttribute('data-public-boot');
    clearTimeout(timer);
    document.removeEventListener('clementino:app-ready',finish);
    window.removeEventListener('error',failed,true);
    var screen=document.getElementById('public-startup');
    if(screen)screen.remove();
  }
  function failed(event){
    if(event.target===window||(event.target&&event.target.tagName==='SCRIPT'&&event.target.type==='module'))finish();
  }
  root.setAttribute('data-public-boot','');
  document.addEventListener('clementino:app-ready',finish);
  window.addEventListener('error',failed,true);
  timer=setTimeout(finish,8000);
})();
</script>
<!-- public-startup:end -->`;

export const publicStartupScreen = `<div id="public-startup" role="status" aria-label="Carregando página">
  <img src="/images/brand/clementino-logo.webp?v=20261015" alt="Clementino Imóveis" width="220" height="57" />
  <span aria-hidden="true"></span>
  <p>Carregando…</p>
</div>`;

export const withPublicStartup = (html: string): string => html
  .replace(/<!-- public-startup:start -->[\s\S]*?<!-- public-startup:end -->/g, '')
  .replace('</head>', `${startupHead}\n</head>`);
