(function(){
'use strict';
if(window.ETOS_ADMIN_LAUNCHER_V36)return;window.ETOS_ADMIN_LAUNCHER_V36=true;
async function openFacilitatorEditor(){try{await window.goView?.('datacenter');await window.loadDataCenterTable?.('facilitators')}catch(e){window.toast?.(e?.message||String(e),'error')}}
function repair(){
 const b=document.querySelector('.nav-btn[data-view="datacenter"]');if(b&&!b.id)b.id='data-center-nav';
 const profile=document.getElementById('view-profile'),head=profile?.firstElementChild;
 if(profile&&head&&!profile.querySelector('.profile-edit-launcher')){const edit=document.createElement('button');edit.className='profile-edit-launcher btn btn-green';edit.innerHTML='<i data-lucide="pencil" class="w-4 h-4"></i>Edit Profil';edit.onclick=openFacilitatorEditor;head.appendChild(edit)}
 window.lucide?.createIcons?.();
}
repair();window.addEventListener('etos:enhancements-ready',repair,{once:true});
})();
