/* ETOS READMAP sample workspace. Browser-local only; NEVER writes to Supabase. */
(()=>{'use strict';
const KEY='etos-readmap-demo-v2';
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(week){
 const weeks=Array.from({length:7},(_,i)=>{const d=new Date(week+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()-7*(6-i));return d.toLocaleDateString('sv-SE',{timeZone:'Asia/Makassar'})});
 const covers=id=>'https://covers.openlibrary.org/b/isbn/'+id+'-L.jpg';
 const books=[
 {id:'demo-b1',current_page:320,title:'Atomic Habits',author:'James Clear',category:'Pengembangan Diri',total_pages:320,status:'Selesai',cover_path:covers('9780735211292')},
 {id:'demo-b2',current_page:256,title:'The Psychology of Money',author:'Morgan Housel',category:'Bisnis & Karier',total_pages:256,status:'Selesai',cover_path:covers('9780857197689')},
 {id:'demo-b3',current_page:146,title:'Deep Work',author:'Cal Newport',category:'Pengembangan Diri',total_pages:304,status:'Sedang Dibaca',cover_path:covers('9781455586691')},
 {id:'demo-b4',current_page:83,title:'Start With Why',author:'Simon Sinek',category:'Kepemimpinan',total_pages:256,status:'Sedang Dibaca',cover_path:covers('9781591846444')},
 {id:'demo-b5',current_page:50,title:'The 7 Habits of Highly Effective People',author:'Stephen R. Covey',category:'Kepemimpinan',total_pages:432,status:'Sedang Dibaca',cover_path:covers('9781982137274')}
 ];
 const sample=[
 ['demo-b1',weeks[0],37,'Kebiasaan kecil yang konsisten lebih kuat daripada perubahan besar yang hanya sesaat.'],
 ['demo-b1',weeks[1],49,'Membuat kebiasaan mudah dilakukan akan membantu kita memulainya.'],
 ['demo-b2',weeks[2],60,'Cara kita memandang uang dipengaruhi pengalaman hidup, bukan angka semata.'],
 ['demo-b2',weeks[3],54,'Menabung adalah bentuk kebebasan memilih untuk masa depan.'],
 ['demo-b3',weeks[4],38,'Fokus mendalam membutuhkan batasan terhadap gangguan digital.'],
 ['demo-b4',weeks[5],43,'Memimpin dimulai dari memahami alasan dan tujuan.'],
 ['demo-b5',weeks[6],28,'Prioritas penting harus didahulukan sebelum urusan mendesak.']
 ];
 const entries=sample.map(([book_id,week_start,pages_read,insight],i)=>({id:'demo-e'+i,book_id,week_start,pages_read,insight,input_mode:'jumlah',awardee_id:'demo'}));
 const videos=[
 {id:'demo-v1',youtube_id:'TjPFZaMe2yw',title:'3 Tips on How to Study Effectively · TED-Ed',duration_seconds:300,watched_intervals:[[0,300]],last_position_seconds:300,status:'Selesai',insight:'Mengulang materi secara terjadwal membuat proses belajar lebih efektif.'},
 {id:'demo-v2',youtube_id:'mA1lnxfqHk8',title:'The Missing Ingredient in How We Learn · TED-Ed',duration_seconds:320,watched_intervals:[[0,320]],last_position_seconds:320,status:'Selesai',insight:'Belajar aktif dan mencoba sendiri membuat pemahaman lebih kuat.'},
 {id:'demo-v3',youtube_id:'aircAruvnKk',title:'But What Is a Neural Network? · 3Blue1Brown',duration_seconds:1120,watched_intervals:[[0,500]],last_position_seconds:500,status:'Sedang Belajar',insight:''},
 {id:'demo-v4',youtube_id:'5MgBikgcWnY',title:'The First 20 Hours: How to Learn Anything · TEDx',duration_seconds:1160,watched_intervals:[[0,630]],last_position_seconds:630,status:'Sedang Belajar',insight:''},
 {id:'demo-v5',youtube_id:'rfscVS0vtbw',title:'Learn Python — Full Course for Beginners · freeCodeCamp',duration_seconds:14500,watched_intervals:[],last_position_seconds:0,status:'Belum Dimulai',insight:''}
 ].map(v=>({...v,awardee_id:'demo',thumbnail_url:'https://i.ytimg.com/vi/'+v.youtube_id+'/hqdefault.jpg'}));
 return {books,entries,videos};
}
function load(week){try{const value=localStorage.getItem(KEY);if(value){const o=JSON.parse(value);if(Array.isArray(o.books)&&Array.isArray(o.entries)&&Array.isArray(o.videos)){const defaults=fixture(week);o.books.forEach(b=>{if(b.current_page===undefined){const match=defaults.books.find(x=>x.id===b.id);b.current_page=match?.current_page??0}});return o}}}catch(_){}return fixture(week)}
function save(o){try{localStorage.setItem(KEY,JSON.stringify({books:o.books,entries:o.entries,videos:o.videos}))}catch(_){}}
function reset(week){try{localStorage.removeItem(KEY)}catch(_){}return fixture(week)}
window.READMAP_DEMO={load,save,reset,clone};
})();