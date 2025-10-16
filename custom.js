/* Jellyflix Custom JS - for Jellyfin 10.10.7
   Adds hero carousel, random selection, autoplay trailers (muted), hover unmute */
(function(){
  // Wait until home page loads
  function ready(fn){
    if(document.readyState!='loading') return fn();
    document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function(){
    // Helper to query items from existing page lists
    function collectItems(){
      // Jellyfin renders items with class 'item' inside .itemRows; adapt if structure differs
      const items = Array.from(document.querySelectorAll('.itemRow .item, .item')) || [];
      // filter distinct poster and itemId
      const seen = new Set();
      const out = [];
      items.forEach(el=>{
        try{
          const img = el.querySelector('img');
          const href = el.querySelector('a') ? el.querySelector('a').href : null;
          const id = el.getAttribute('data-id') || (href && href.match(/\/Items\/([^\/\?]+)/) && href.match(/\/Items\/([^\/\?]+)/)[1]);
          const title = el.querySelector('.name') ? el.querySelector('.name').innerText.trim() : (img && img.alt) || '';
          const src = img ? img.src : null;
          if(id && !seen.has(id)){
            seen.add(id);
            out.push({id,title,src,href});
          }
        }catch(e){}
      });
      return out;
    }

    // Build hero container
    function makeHero(){
      const hero = document.createElement('div');
      hero.className = 'jellyflix-hero';
      const slides = document.createElement('div');
      slides.className = 'slides';
      hero.appendChild(slides);
      const container = document.querySelector('.homePage') || document.body;
      container.insertBefore(hero, container.firstChild);

      const items = collectItems();
      if(items.length===0){
        // fallback: try items from recentlyAdded
        const fallback = Array.from(document.querySelectorAll('[data-section] .item'));
        fallback.forEach((el,i)=>{
          const img = el.querySelector('img');
          const href = el.querySelector('a') ? el.querySelector('a').href : null;
          const id = el.getAttribute('data-id') || (href && href.match(/\/Items\/([^\/\?]+)/) && href.match(/\/Items\/([^\/\?]+)/)[1]);
          const title = img ? img.alt : 'Item '+i;
          if(id) items.push({id,title,src:img?img.src:null,href});
        });
      }

      // pick 5 random unique items
      const picks = [];
      for(let i=0;i<5 && items.length>0;i++){
        const idx = Math.floor(Math.random()*items.length);
        picks.push(items.splice(idx,1)[0]);
      }

      const slidesEl = hero.querySelector('.slides');
      picks.forEach((it, index)=>{
        const s = document.createElement('div');
        s.className='slide';
        s.style.backgroundImage = it.src ? 'url("'+it.src+'")' : '';
        s.innerHTML = '<div class="meta"><h1>'+ (it.title||'Untitled') +'</h1><p>A featured selection from your library.</p><div><button class="btn primary" data-item="'+it.id+'">Play</button> <button class="btn" data-trailer="'+it.id+'">Trailer</button></div></div>';
        slidesEl.appendChild(s);
      });

      // autoplay slides
      let current = 0;
      function show(idx){
        slidesEl.style.transform = 'translateX(-'+(idx*100)+'%)';
        current = idx;
      }
      let interval = setInterval(function(){
        let n = (current+1) % slidesEl.children.length;
        show(n);
      }, 6000);

      // pause on hover
      hero.addEventListener('mouseenter', ()=> clearInterval(interval));
      hero.addEventListener('mouseleave', ()=> interval = setInterval(function(){ let n=(current+1)%slidesEl.children.length; show(n);},6000));

      // play/trailer handlers (use Jellyfin's client play link if present)
      hero.addEventListener('click', function(e){
        const btn = e.target.closest('button');
        if(!btn) return;
        const id = btn.getAttribute('data-item') || btn.getAttribute('data-trailer');
        if(!id) return;
        if(btn.getAttribute('data-item')){
          // navigate to item page
          const link = '/web/index.html#!/details?itemId='+id;
          window.location.href = link;
        } else {
          // open quick trailer overlay - attempt to construct trailer URL via /Videos/{id}/stream?static=trailer
          showTrailer(id, btn);
        }
      });
    }

    // Show trailer overlay - attempt to play the media via Jellyfin's video player endpoint
    function showTrailer(itemId, btn){
      // Create overlay
      let ov = document.querySelector('.jellyflix-trailer-overlay');
      if(ov) ov.remove();
      ov = document.createElement('div');
      ov.className='jellyflix-trailer-overlay';
      ov.style = 'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
      const playerWrap = document.createElement('div');
      playerWrap.style = 'width:80%;max-width:1100px;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;position:relative;';
      const video = document.createElement('video');
      video.controls = true;
      video.muted = true;
      video.autoplay = true;
      video.style.width='100%'; video.style.height='100%';
      // Attempt construct stream URL for trailers (this may require auth cookie - works when logged in)
      // First try common trailer path
      const trailerUrl = window.location.origin + '/Videos/' + itemId + '/stream?static=true&mediaSourceId=' + itemId + '&DeviceId=jellyflix';
      video.src = trailerUrl;
      // If not playable, user can close overlay
      const closeBtn = document.createElement('button');
      closeBtn.innerText='✕';
      closeBtn.style = 'position:absolute;right:10px;top:8px;background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer;';
      closeBtn.onclick = ()=> ov.remove();
      playerWrap.appendChild(video);
      playerWrap.appendChild(closeBtn);
      ov.appendChild(playerWrap);
      document.body.appendChild(ov);

      // Unmute on hover
      playerWrap.addEventListener('mouseenter', ()=> { video.muted = false; });
      playerWrap.addEventListener('mouseleave', ()=> { video.muted = true; });
    }

    // Inject rows styling wrapper for existing rows
    function wrapRows(){
      const rows = document.querySelectorAll('.itemRows, .section .row');
      rows.forEach(r=>{
        if(r.classList.contains('jellyflix-row')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'jellyflix-row';
        const title = r.querySelector('.sectionTitle, h2') ? (r.querySelector('.sectionTitle, h2').innerText || '') : '';
        const h = document.createElement('h2');
        h.innerText = title || 'Collection';
        wrapper.appendChild(h);
        const inner = document.createElement('div');
        inner.className = 'row-inner';
        // move first 20 child items
        const items = r.querySelectorAll('.item');
        items.forEach((it,idx)=>{
          if(idx>19) return;
          const card = document.createElement('div');
          card.className='card';
          const img = it.querySelector('img') ? it.querySelector('img').cloneNode() : document.createElement('img');
          img.alt = it.querySelector('.name') ? it.querySelector('.name').innerText : '';
          card.appendChild(img);
          const t = document.createElement('div');
          t.className='title';
          t.innerText = img.alt || 'Title';
          card.appendChild(t);
          inner.appendChild(card);
        });
        wrapper.appendChild(inner);
        // insert wrapper after original element
        r.parentNode.insertBefore(wrapper, r.nextSibling);
      });
    }

    // Kickoff after small delay to allow Jellyfin render
    setTimeout(function(){
      try{ makeHero(); } catch(e){ console.error(e); }
      try{ wrapRows(); } catch(e){ console.error(e); }
    },1200);

  });
})();