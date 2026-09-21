const KEY="smaryplan_complete_v2";
const today=()=>new Date().toISOString().slice(0,10);
let db=JSON.parse(localStorage.getItem(KEY)||'{"courses":[],"lessons":[],"checks":{},"goals":[]}');

const $=id=>document.getElementById(id);
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function course(id){return db.courses.find(c=>c.id===id)}
function lessons(id){return db.lessons.filter(l=>l.courseId===id)}
function completed(id){return lessons(id).filter(l=>l.done).length}
function pct(id){let c=course(id);return c?Math.min(100,Math.round(completed(id)/c.totalLessons*100)):0}
function totalLessons(){return db.courses.reduce((a,c)=>a+c.totalLessons,0)}
function totalMinutes(){return db.lessons.reduce((a,l)=>a+(+l.minutes||0),0)}
function streak(){let dates=new Set(db.lessons.filter(l=>l.done).map(l=>l.date));let n=0,d=new Date();while(dates.has(d.toISOString().slice(0,10))){n++;d.setDate(d.getDate()-1)}return n}
function formatMin(m){m=Number(m)||0;return m<60?m+"m":Math.floor(m/60)+"h "+m%60+"m"}

document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>go(btn.dataset.page)));
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>go(btn.dataset.go)));

function go(page){
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 $("page-"+page).classList.add("active");
 document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 const names={dashboard:"Dashboard",courses:"Courses",today:"Today's Lessons",notes:"Lesson Notes",progress:"Daily Progress",streak:"Learning Streak",time:"Time Tracking",goals:"Learning Goals",check:"Daily Check"};
 $("pageTitle").textContent=names[page]||"Dashboard";
 $("pageSubtitle").textContent=page==="dashboard"?"Your learning overview":"Manage your learning";
 closeMenu();renderAll();
}
$("menuBtn").onclick=()=>{ $("sidebar").classList.add("open");$("overlay").classList.add("show")};
$("overlay").onclick=closeMenu;
function closeMenu(){$("sidebar").classList.remove("open");$("overlay").classList.remove("show")}

$("darkBtn").onclick=()=>{
 document.body.classList.toggle("dark");
 localStorage.setItem("smaryplan_dark",document.body.classList.contains("dark"));
 $("darkBtn").innerHTML=document.body.classList.contains("dark")?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';
};
if(localStorage.getItem("smaryplan_dark")==="true"){$("darkBtn").click()}

$("courseForm").onsubmit=e=>{
 e.preventDefault();
 const total=Number($("totalLessons").value);
 db.courses.push({id:Date.now(),name:$("courseName").value.trim(),type:$("courseType").value,skill:$("skillName").value.trim(),totalLessons:total,start:$("startDate").value,target:$("targetDate").value,goal:$("courseGoal").value.trim(),created:Date.now()});
 save();e.target.reset();renderAll();alert("Course created successfully.");
};

$("lessonCourse").onchange=populateLessonNumbers;
function populateLessonNumbers(){
 const id=Number($("lessonCourse").value), c=course(id);$("lessonNumber").innerHTML="";
 if(!c)return;
 for(let i=1;i<=c.totalLessons;i++){
   const used=db.lessons.some(l=>l.courseId===id&&l.day===i);
   $("lessonNumber").insertAdjacentHTML("beforeend",`<option value="${i}" ${used?"disabled":""}>Day ${i}${used?" — completed":" — available"}</option>`);
 }
}
$("lessonForm").onsubmit=e=>{
 e.preventDefault();
 const cid=Number($("lessonCourse").value),day=Number($("lessonNumber").value),date=$("lessonDate").value;
 if(db.lessons.some(l=>l.courseId===cid&&l.day===day)){alert("This lesson is already recorded.");return}
 db.lessons.push({id:Date.now(),courseId:cid,day,title:$("lessonTitle").value.trim(),topic:$("lessonTopic").value.trim(),date,minutes:Number($("lessonMinutes").value)||0,notes:$("lessonNotes").value.trim(),practice:$("practiceDone").checked,quiz:$("quizDone").checked,done:$("lessonDone").checked});
 save();e.target.reset();$("lessonDate").value=today();populateLessonNumbers();renderAll();alert("Lesson saved.");
};

$("saveCheck").onclick=()=>{
 db.checks[today()]={study:$("checkStudy").checked,practice:$("checkPractice").checked,review:$("checkReview").checked,notes:$("checkNotes").checked};
 save();renderAll();alert("Daily check saved.");
};

function renderDashboard(){
 $("dashCourses").textContent=db.courses.length;
 $("dashLessons").textContent=completedAll()+"/"+totalLessons();
 $("dashProgress").textContent=(totalLessons()?Math.round(completedAll()/totalLessons()*100):0)+"%";
 $("dashStreak").textContent=streak()+" days";$("dashTime").textContent=formatMin(totalMinutes());
 const goalTotal=db.courses.filter(c=>c.goal).length,goalDone=db.courses.filter(c=>c.goal&&pct(c.id)>=100).length;
 $("dashGoals").textContent=goalDone+"/"+goalTotal;
 const ts=db.lessons.filter(l=>l.date===today());
 $("dashToday").innerHTML=ts.length?ts.map(lessonHTML).join(""):'<div class="empty">No lesson recorded for today.</div>';
 const ch=db.checks[today()]||{};
 $("dashCheck").innerHTML=`<p>${ch.study?"☑":"☐"} Studied today</p><p>${ch.practice?"☑":"☐"} Practiced</p><p>${ch.review?"☑":"☐"} Reviewed previous lesson</p><p>${ch.notes?"☑":"☐"} Wrote notes</p>`;
 $("dashCoursesList").innerHTML=db.courses.length?db.courses.map(courseHTML).join(""):'<div class="empty">Create your first course.</div>';
}
function completedAll(){return db.lessons.filter(l=>l.done).length}
function courseHTML(c){
 const p=pct(c.id),n=completed(c.id);
 return `<div class="course"><h4>${esc(c.name)}</h4><small>${esc(c.type)} · ${esc(c.skill)}</small><div class="progress-wrap"><div class="progress-bar"><span style="width:${p}%"></span></div><span class="progress-text">${p}%</span></div><small>${n}/${c.totalLessons} lessons completed</small>${c.goal?`<p><small>Goal: ${esc(c.goal)}</small></p>`:""}<div class="course-actions"><button class="btn primary small" onclick="openCourse(${c.id})">Open</button><button class="btn secondary small" onclick="deleteCourse(${c.id})">Delete</button></div></div>`
}
function lessonHTML(l){
 return `<div class="lesson"><div class="day">Day ${l.day}</div><div><h4>${l.done?"☑":"☐"} ${esc(l.title)}</h4><p>${esc(l.topic||"No topic")} · ${l.date} · ${formatMin(l.minutes)} ${l.practice?"· Practice ✓":""} ${l.quiz?"· Quiz ✓":""}</p></div><button class="btn secondary small" onclick="deleteLesson(${l.id})">Delete</button></div>`
}
function openCourse(id){$("lessonCourse").value=id;populateLessonNumbers();go("today")}
function deleteCourse(id){if(!confirm("Delete this course and all its lessons?"))return;db.courses=db.courses.filter(c=>c.id!==id);db.lessons=db.lessons.filter(l=>l.courseId!==id);save();renderAll()}
function deleteLesson(id){db.lessons=db.lessons.filter(l=>l.id!==id);save();renderAll();populateLessonNumbers()}

function renderCourses(){$("courseList").innerHTML=db.courses.length?db.courses.map(courseHTML).join(""):'<div class="empty">No courses yet.</div>'}
function renderToday(){
 $("lessonCourse").innerHTML=db.courses.length?'<option value="">Select course</option>'+db.courses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(""):'<option value="">Create a course first</option>';
 if(!$("lessonDate").value)$("lessonDate").value=today();populateLessonNumbers();
 const list=[...db.lessons].sort((a,b)=>b.date.localeCompare(a.date)||b.day-a.day);
 $("lessonHistory").innerHTML=list.length?list.map(lessonHTML).join(""):'<div class="empty">No lessons yet.</div>';
}
function renderNotes(){
 const list=db.lessons.filter(l=>l.notes).sort((a,b)=>b.date.localeCompare(a.date));
 $("notesList").innerHTML=list.length?list.map(l=>{let c=course(l.courseId);return `<div class="note"><h4>${esc(c?.name||"Course")} — Day ${l.day}: ${esc(l.title)}</h4><p>${esc(l.notes)}</p><small>${l.date}</small></div>`}).join(""):'<div class="empty">No lesson notes yet.</div>';
}
function renderProgress(){
 const groups={};db.lessons.forEach(l=>{if(!groups[l.date])groups[l.date]=[];groups[l.date].push(l)});
 const dates=Object.keys(groups).sort().reverse();
 $("dailyProgressList").innerHTML=dates.length?dates.map(d=>`<div class="note"><h4>${d}</h4><p>${groups[d].filter(x=>x.done).length} lessons completed · ${formatMin(groups[d].reduce((a,x)=>a+x.minutes,0))} studied</p></div>`).join(""):'<div class="empty">No daily progress yet.</div>';
}
function renderStreak(){
 $("bigStreak").textContent=streak();
 const dates=[...new Set(db.lessons.map(l=>l.date))].sort().reverse();
 $("activityList").innerHTML=dates.length?dates.slice(0,30).map(d=>`<div class="note"><strong>${d}</strong><p>${db.lessons.filter(l=>l.date===d).length} lesson(s) · ${formatMin(db.lessons.filter(l=>l.date===d).reduce((a,x)=>a+x.minutes,0))}</p></div>`).join(""):'<div class="empty">No activity yet.</div>';
}
function renderTime(){
 const t=today(),now=new Date(),week=new Date(now);week.setDate(now.getDate()-6);const start=week.toISOString().slice(0,10);
 $("timeToday").textContent=formatMin(db.lessons.filter(l=>l.date===t).reduce((a,l)=>a+l.minutes,0));
 $("timeWeek").textContent=formatMin(db.lessons.filter(l=>l.date>=start&&l.date<=t).reduce((a,l)=>a+l.minutes,0));
 $("timeTotal").textContent=formatMin(totalMinutes());
 $("timeList").innerHTML=db.lessons.length?[...db.lessons].sort((a,b)=>b.date.localeCompare(a.date)).map(l=>`<div class="note"><strong>${l.date} — Day ${l.day}</strong><p>${esc(course(l.courseId)?.name||"Course")} · ${formatMin(l.minutes)}</p></div>`).join(""):'<div class="empty">No time records yet.</div>';
}
function renderGoals(){
 $("goalsList").innerHTML=db.courses.length?db.courses.map(c=>`<div class="note"><h4>${esc(c.name)}</h4><p>${esc(c.goal||"No goal added.")}</p><div class="progress-wrap"><div class="progress-bar"><span style="width:${pct(c.id)}%"></span></div><span class="progress-text">${pct(c.id)}%</span></div></div>`).join(""):'<div class="empty">No learning goals yet.</div>';
}
function renderCheck(){
 $("checkDate").textContent="Daily Check — "+today();const c=db.checks[today()]||{};
 $("checkStudy").checked=!!c.study;$("checkPractice").checked=!!c.practice;$("checkReview").checked=!!c.review;$("checkNotes").checked=!!c.notes;
}
function renderAll(){renderDashboard();renderCourses();renderToday();renderNotes();renderProgress();renderStreak();renderTime();renderGoals();renderCheck()}
renderAll();
