(function(){
'use strict';
if(window.ETOS_ADMIN_LAUNCHER_V36)return;window.ETOS_ADMIN_LAUNCHER_V36=true;
function repair(){const b=document.querySelector('.nav-btn[data-view="datacenter"]');if(b&&!b.id)b.id='data-center-nav';window.lucide?.createIcons?.()}
repair();window.addEventListener('etos:enhancements-ready',repair,{once:true});
})();
