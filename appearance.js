'use strict';
const motionToggle=document.getElementById('motion-toggle');
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
let motionStopped=motionPreference.matches;
try{motionStopped=motionStopped||localStorage.getItem('kazuchan-motion-stopped')==='true';}catch{}
function renderMotion(){document.body.classList.toggle('motion-stopped',motionStopped);motionToggle.setAttribute('aria-pressed',String(motionStopped));motionToggle.textContent=motionStopped?'猫の動きを再開する':'猫の動きを止める';}
motionToggle.addEventListener('click',()=>{motionStopped=!motionStopped;try{localStorage.setItem('kazuchan-motion-stopped',String(motionStopped));}catch{}renderMotion();});
motionPreference.addEventListener('change',event=>{if(event.matches){motionStopped=true;renderMotion();}});
renderMotion();
