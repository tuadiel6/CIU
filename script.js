/* Paste your Google Apps Script web app URL here (see booking/SETUP-BOOKING.md).
   Leave it empty to show the calendar with example dates. */
var BOOKING_API = '';

(function(){
  function copyText(t, btn){
    var done=function(){var o=btn.textContent;btn.textContent='Copied';setTimeout(function(){btn.textContent=o},1600)};
    try{navigator.clipboard.writeText(t).then(done,function(){fallback(t);done()})}catch(e){fallback(t);done()}
  }
  function fallback(t){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(e){}a.remove()}
  document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){copyText(b.getAttribute('data-copy'),b)})});

  var mt=document.getElementById('menu-toggle'), nl=document.getElementById('nav-links');
  mt.addEventListener('click',function(){var o=nl.classList.toggle('open');mt.setAttribute('aria-expanded',String(o));mt.textContent=o?'Close':'Menu'});
  nl.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){nl.classList.remove('open');mt.setAttribute('aria-expanded','false');mt.textContent='Menu'})});
  // Theme toggle
  var root=document.documentElement, tb=document.getElementById('theme-toggle'), mq=window.matchMedia('(prefers-color-scheme: dark)');
  function isDark(){var t=root.getAttribute('data-theme');return t?t==='dark':mq.matches}
  function paint(){var d=isDark();tb.querySelector('.i-sun').toggleAttribute('hidden',!d);tb.querySelector('.i-moon').toggleAttribute('hidden',d);var l=d?'Switch to light mode':'Switch to dark mode';tb.setAttribute('aria-label',l);tb.title=l;
    var tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.setAttribute('content',d?'#0F1A14':'#1E5B3C')}
  try{var saved=localStorage.getItem('ciu-theme');if(saved==='dark'||saved==='light')root.setAttribute('data-theme',saved)}catch(e){}
  tb.addEventListener('click',function(){var n=isDark()?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('ciu-theme',n)}catch(e){}paint()});
  if(mq.addEventListener)mq.addEventListener('change',paint);
  if(window.MutationObserver)new MutationObserver(paint).observe(root,{attributes:true,attributeFilter:['data-theme']});
  paint();

  // One page per menu tab
  var pages={'home':'Centre Ishema ry\u2019Umuryango','about':'About us','services':'Our services','get-help':'How to get help','team':'Our team','contact':'Book an appointment'};
  var secs=document.querySelectorAll('[data-page]'), current=null, baseTitle='Centre Ishema ry\u2019Umuryango';
  function route(moveFocus){
    var h=location.hash.slice(1);
    if(!pages.hasOwnProperty(h)){if(current&&h)return;h='home'}
    current=h;
    secs.forEach(function(sec){sec.hidden=sec.getAttribute('data-page').split(' ').indexOf(h)<0});
    document.querySelectorAll('[data-nav]').forEach(function(a){if(a.getAttribute('href')==='#'+h)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
    document.title=h==='home'?baseTitle+' | Journey to happiness':pages[h]+' | '+baseTitle;
    window.scrollTo({top:0,left:0,behavior:'instant'});
    if(moveFocus){var hd=document.querySelector('[data-page~="'+h+'"] h1, [data-page~="'+h+'"] h2');if(hd){hd.setAttribute('tabindex','-1');hd.focus({preventScroll:true})}}
  }
  window.addEventListener('hashchange',function(){route(true)});
  route(false);

  var y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();

  // ---------- Appointment booking ----------
  var $=function(id){return document.getElementById(id)};
  var live=/^https:\/\/script\.google\.com\//.test(BOOKING_API||'');
  var st={days:{},first:null,last:null,session:60,view:null,date:null,time:null};
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var phoneHelp=' call +250 788 733 368.';
  function pad(n){return (n<10?'0':'')+n}
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function parse(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2],12)}
  function pretty(s){return parse(s).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
  function status(t){var el=$('bk-status');el.textContent=t||'';el.hidden=!t}

  function demoData(){
    var days={},today=new Date(),first=ymd(today),last=first;
    var plan={1:['08:30','09:30','10:30','11:30','14:00','15:00','16:00'],3:['08:30','09:30','10:30','11:30','14:00','15:00','16:00'],5:['08:30','09:30','10:30','11:30'],6:['09:00','10:00','11:00']};
    for(var i=2;i<=45;i++){var d=new Date(today.getFullYear(),today.getMonth(),today.getDate()+i,12);last=ymd(d);
      var t=(plan[d.getDay()]||[]).filter(function(x,j){return (d.getDate()*7+j*3)%5!==0});
      if(t.length)days[ymd(d)]=t}
    return {ok:true,sessionMinutes:60,firstDate:first,lastDate:last,days:days};
  }
  function load(){
    status('Loading available dates…');
    var p=live?fetch(BOOKING_API+'?action=availability',{cache:'no-store'}).then(function(r){return r.json()}):Promise.resolve(demoData());
    return p.then(function(d){
      if(!d||!d.ok)throw new Error('bad');
      st.days=d.days||{};st.first=d.firstDate;st.last=d.lastDate;st.session=d.sessionMinutes||60;
      $('bk-length').textContent='Each appointment lasts '+st.session+' minutes. Times are Rwanda time.';
      var keys=Object.keys(st.days).sort();
      if(!st.view){var f=parse(keys[0]||st.first);st.view=new Date(f.getFullYear(),f.getMonth(),1)}
      status(keys.length?'':'There are no free times at the moment. Please'+phoneHelp);
      drawMonth();
    }).catch(function(){
      status('We could not load the calendar. Check your connection and reload the page, or'+phoneHelp);
    });
  }
  function drawMonth(){
    var g=$('bk-grid'),v=st.view,y=v.getFullYear(),m=v.getMonth();
    $('bk-month').textContent=MONTHS[m]+' '+y;
    var html=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(d){return '<span class="cal-dow" aria-hidden="true">'+d+'</span>'}).join('');
    var lead=(new Date(y,m,1).getDay()+6)%7, n=new Date(y,m+1,0).getDate(), today=ymd(new Date());
    for(var i=0;i<lead;i++)html+='<span class="cal-day empty" aria-hidden="true"></span>';
    for(var d=1;d<=n;d++){
      var k=y+'-'+pad(m+1)+'-'+pad(d), t=st.days[k], cls='cal-day'+(k===today?' today':'');
      if(t&&t.length)html+='<button type="button" class="'+cls+'" data-date="'+k+'" aria-pressed="'+(k===st.date)+'" aria-label="'+pretty(k)+', '+t.length+(t.length>1?' free times':' free time')+'">'+d+'</button>';
      else html+='<span class="'+cls+'" aria-hidden="true">'+d+'</span>';
    }
    g.innerHTML=html;
    var f=parse(st.first),l=parse(st.last);
    $('bk-prev').disabled=(y<f.getFullYear()||(y===f.getFullYear()&&m<=f.getMonth()));
    $('bk-next').disabled=(y>l.getFullYear()||(y===l.getFullYear()&&m>=l.getMonth()));
  }
  function pickDate(k){
    st.date=k;st.time=null;
    drawMonth();
    $('bk-day-label').textContent='Free times on '+pretty(k);
    $('bk-slots').innerHTML=st.days[k].map(function(t){return '<button type="button" class="slot" data-time="'+t+'" aria-pressed="false">'+t+'</button>'}).join('');
    $('bk-times').hidden=false;
    $('bk-times').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function pickTime(t){
    st.time=t;
    $('bk-picked').textContent=pretty(st.date)+' at '+t;
    $('bk-pick').hidden=true;$('bk-form').hidden=false;$('bk-err').hidden=true;
    $('bk-title').textContent='Your details';
    $('bk-service').focus();
  }
  function backToCalendar(){
    $('bk-form').hidden=true;$('bk-done').hidden=true;$('bk-pick').hidden=false;
    $('bk-title').textContent='Choose a date and time';
  }
  function showErr(t){var e=$('bk-err');e.textContent=t;e.hidden=false}

  $('bk-grid').addEventListener('click',function(e){var b=e.target.closest('button[data-date]');if(b)pickDate(b.getAttribute('data-date'))});
  $('bk-slots').addEventListener('click',function(e){var b=e.target.closest('button[data-time]');if(b)pickTime(b.getAttribute('data-time'))});
  $('bk-prev').addEventListener('click',function(){st.view=new Date(st.view.getFullYear(),st.view.getMonth()-1,1);drawMonth()});
  $('bk-next').addEventListener('click',function(){st.view=new Date(st.view.getFullYear(),st.view.getMonth()+1,1);drawMonth()});
  $('bk-change').addEventListener('click',function(){backToCalendar();var b=document.querySelector('#bk-slots [data-time="'+st.time+'"]');if(b)b.focus()});
  $('bk-again').addEventListener('click',function(){st.date=null;st.time=null;$('bk-times').hidden=true;$('bk-form').reset();backToCalendar();load()});

  $('bk-form').addEventListener('submit',function(e){
    e.preventDefault();
    var F=this.elements, name=F['name'].value.trim(), phone=F['phone'].value.trim(), email=F['email'].value.trim();
    if(name.length<2){showErr('Enter your name so we know who to expect.');F['name'].focus();return}
    if(!/^[+0-9 ()-]{7,20}$/.test(phone)){showErr('Enter a phone number with digits only, for example +250 788 123 456.');F['phone'].focus();return}
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showErr('Check your email address, or leave it empty.');F['email'].focus();return}
    $('bk-err').hidden=true;
    var payload={date:st.date,time:st.time,service:F['service'].value,name:name,phone:phone,email:email,message:F['message'].value.trim(),website:F['website'].value};
    var btn=$('bk-submit');btn.disabled=true;btn.textContent='Booking…';
    var req=live?fetch(BOOKING_API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}).then(function(r){return r.json()})
      :new Promise(function(res){setTimeout(function(){res({ok:true,reference:'DEMO-'+Math.random().toString(36).slice(2,6).toUpperCase()})},600)});
    req.then(function(r){
      if(r&&r.ok){
        $('bk-d-when').textContent=pretty(st.date)+' at '+st.time+' ('+st.session+' minutes)';
        $('bk-d-service').textContent=payload.service;
        $('bk-d-ref').textContent=r.reference;
        $('bk-d-email').textContent=live?(email?'A confirmation has been sent to '+email+'.':'Write down your reference; you will need it if you call us.'):'This was an example booking. Nothing was saved.';
        $('bk-form').hidden=true;$('bk-done').hidden=false;$('bk-title').hidden=true;$('bk-done').focus();
        if(st.days[st.date]){st.days[st.date]=st.days[st.date].filter(function(t){return t!==st.time});if(!st.days[st.date].length)delete st.days[st.date]}
      }else if(r&&r.error==='taken'){
        backToCalendar();$('bk-times').hidden=true;
        load().then(function(){if(st.days[st.date])pickDate(st.date);status('Someone has just booked that time. Please choose another one.')});
      }else if(r&&r.error==='invalid'){
        showErr('Some details could not be accepted. Check your name and phone number and try again.');
      }else throw new Error('server');
    }).catch(function(){
      showErr('Your appointment was not booked because we could not reach the booking system. Try again, or'+phoneHelp);
    }).then(function(){btn.disabled=false;btn.textContent='Book this appointment'});
  });
  $('bk-again').addEventListener('click',function(){$('bk-title').hidden=false});
  if(!live)$('bk-demo').hidden=false;
  load();
})();
