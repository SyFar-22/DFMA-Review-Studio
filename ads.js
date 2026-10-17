/* Advertising settings. Edit only this file.
   1. Put your AdSense publisher ID in client (it looks like ca-pub-1234567890123456).
   2. In AdSense, create three display ad units and put their slot numbers below:
      inArticle and bottom (responsive), rail (fixed 160 x 600, shown in the left menu on large screens only).
   3. Set enabled to true. Until then no ads and no ad scripts load.
   Consent for EEA, UK and Swiss visitors: turn on the Google certified consent message in AdSense > Privacy & messaging. */
window.ADS = { enabled: false, client: 'ca-pub-XXXXXXXXXXXXXXXX', slots: { inArticle: '0000000000', bottom: '0000000000', rail: '0000000000' } };
(function () {
  var A = window.ADS; if (!A.enabled || /X{6}/.test(A.client)) return;
  var s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + A.client; document.head.appendChild(s);
  function fill() { document.querySelectorAll('.adslot[data-slot]').forEach(function (el) { if (el.dataset.done) return; var id = A.slots[el.dataset.slot]; if (!id || /^0+$/.test(id)) return; if (el.offsetParent === null) return; el.dataset.done = '1';
    var rail = el.dataset.slot === 'rail';
    el.innerHTML = '<div class="lbl">Advertisement</div><ins class="adsbygoogle" style="' + (rail ? 'display:inline-block;width:160px;height:600px' : 'display:block') + '" data-ad-client="' + A.client + '" data-ad-slot="' + id + '"' + (rail ? '' : ' data-ad-format="auto" data-full-width-responsive="true"') + '></ins>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
  // the tool shows its reading pages later, so fill slots when they become visible
  new MutationObserver(function () { fill(); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
})();
