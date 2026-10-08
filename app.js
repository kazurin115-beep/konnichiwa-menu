'use strict';
// Versioned storage and a separate inventory model allow future photos, recipes and shopping lists.
const STORAGE_KEY = 'kazuchan-fridge-v1';
const locations = {fridge:'冷蔵', freezer:'冷凍', pantry:'常温'};
const $ = id => document.getElementById(id);
let foods = [], editingId = null, usingId = null, filter = 'all', storageBroken = false;
function notice(message, error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function validFood(f){return f && typeof f.id==='string' && typeof f.name==='string' && f.name.trim().length>0 && f.name.length<=80 && Number.isFinite(f.quantity) && f.quantity>=0 && typeof f.unit==='string' && f.unit.trim().length>0 && f.unit.length<=20 && Object.hasOwn(locations,f.storage) && ['best','use'].includes(f.expiryType) && typeof f.expiry==='string' && (f.expiry==='' || validDate(f.expiry));}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !isNaN(d) && d.toISOString().slice(0,10)===s;}
function decode(raw){const data=JSON.parse(raw);if(data.version!==1 || !Array.isArray(data.foods) || !data.foods.every(validFood) || new Set(data.foods.map(f=>f.id)).size!==data.foods.length)throw new Error('invalid');return data.foods.map(f=>({id:f.id,name:f.name,quantity:f.quantity,unit:f.unit,storage:f.storage,expiryType:f.expiryType,expiry:f.expiry}));}
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved!==null)foods=decode(saved);}catch{storageBroken=true;notice('保存データを読み込めませんでした。元のデータを守るため変更を止めています。バックアップを戻すか、ブラウザーの保存設定を確認してください。',true);}
function commit(next){if(storageBroken){notice('保存データを読み込めないため変更できません。バックアップを戻してください。',true);return false;}try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,foods:next}));foods=next;render();return true;}catch{notice('保存できませんでした。変更は反映していません。ブラウザーの空き容量や保存設定を確認してください。',true);return false;}}
function daysLeft(date){const now=new Date();const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());return Math.round((Date.parse(date+'T00:00:00Z')-today)/86400000);}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function action(text,cls,handler){const b=el('button',cls,text);b.type='button';b.addEventListener('click',handler);return b;}
function render(){
 $('total').textContent=foods.length;$('soon').textContent=foods.filter(f=>f.quantity>0&&f.expiry&&daysLeft(f.expiry)>=0&&daysLeft(f.expiry)<=3).length;
 const query=$('search').value.trim().toLocaleLowerCase();const visible=foods.filter(f=>(filter==='all'||f.storage===filter)&&f.name.toLocaleLowerCase().includes(query)).sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999'));
 $('count').textContent=visible.length+'件';const list=$('food-list');list.replaceChildren();
 if(!visible.length){list.append(el('p','empty',foods.length?'条件に合う食材がありません。':'まだ食材がありません。上のフォームから登録しましょう。'));return;}
 for(const food of visible){const card=el('article','food');const top=el('div','food-top');const heading=el('div');heading.append(el('span','badge',locations[food.storage]),el('h3','',food.name));const amount=el('div','amount',String(food.quantity));amount.append(el('small','',food.unit));top.append(heading,amount);card.append(top);
 let text='期限の登録なし',cls='expiry';if(food.expiry){const days=daysLeft(food.expiry);text=(food.expiryType==='best'?'賞味期限':'消費期限')+'：'+food.expiry.replaceAll('-','/')+' · '+(days<0?Math.abs(days)+'日前に期限切れ':days===0?'今日まで':'あと'+days+'日');if(days<0)cls+=' expired';else if(days<=3)cls+=' urgent';}card.append(el('p',cls,text));
 const actions=el('div','actions');const use=action('使う','',()=>openUse(food));use.disabled=food.quantity===0;actions.append(use,action('編集','secondary',()=>edit(food)),action('削除','danger',()=>{if(confirm('「'+food.name+'」を削除しますか？')){if(commit(foods.filter(f=>f.id!==food.id))){if(editingId===food.id)resetForm();notice('食材を削除しました。');}}}));card.append(actions);list.append(card);}
}
function resetForm(){editingId=null;$('food-form').reset();$('form-title').textContent='食材を登録';$('submit').textContent='食材を登録する';$('cancel').hidden=true;}
function edit(f){editingId=f.id;for(const [id,value] of Object.entries({name:f.name,quantity:f.quantity,unit:f.unit,storage:f.storage,'expiry-type':f.expiryType,expiry:f.expiry}))$(id).value=value;$('form-title').textContent='食材を編集';$('submit').textContent='変更を保存する';$('cancel').hidden=false;$('name').focus();$('food-form').scrollIntoView({behavior:'smooth',block:'start'});}
$('food-form').addEventListener('submit',e=>{e.preventDefault();const food={id:editingId||crypto.randomUUID(),name:$('name').value.trim(),quantity:Number($('quantity').value),unit:$('unit').value.trim(),storage:$('storage').value,expiryType:$('expiry-type').value,expiry:$('expiry').value};if(!validFood(food)){notice('食材名、0以上の数量、単位、正しい期限を入力してください。',true);return;}const isEdit=!!editingId;const next=isEdit?foods.map(f=>f.id===editingId?food:f):[...foods,food];if(commit(next)){resetForm();notice(isEdit?'変更を保存しました。':'食材を登録しました。');}});
$('cancel').addEventListener('click',resetForm);
function openUse(f){usingId=f.id;$('use-description').textContent=f.name+'（残り '+f.quantity+' '+f.unit+'）';$('use-quantity').value='';$('use-quantity').max=f.quantity;$('use-dialog').showModal();$('use-quantity').focus();}
$('use-cancel').addEventListener('click',()=>$('use-dialog').close());
$('use-form').addEventListener('submit',e=>{e.preventDefault();const f=foods.find(f=>f.id===usingId),used=Number($('use-quantity').value);if(!f||!Number.isFinite(used)||used<=0||used>f.quantity){$('use-quantity').setCustomValidity('残りの数量以下で、0より大きい数を入力してください。');$('use-quantity').reportValidity();return;}const quantity=Number((f.quantity-used).toPrecision(12));if(commit(foods.map(item=>item.id===f.id?{...item,quantity}:item))){$('use-dialog').close();notice('使った数量を減らして保存しました。');}});
$('use-quantity').addEventListener('input',()=>$('use-quantity').setCustomValidity(''));
$('search').addEventListener('input',render);document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
$('export').addEventListener('click',()=>{if(storageBroken){notice('読み込めなかった元データは、この画面からバックアップできません。',true);return;}const blob=new Blob([JSON.stringify({version:1,foods},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='kazuchan-fridge-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('バックアップファイルを保存しました。');});
$('import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('large');const next=decode(await file.text());if(!confirm('現在の在庫をバックアップの '+next.length+'件 に置き換えますか？'))return;const wasBroken=storageBroken;storageBroken=false;if(commit(next)){resetForm();notice('バックアップを戻しました。');}else storageBroken=wasBroken;}catch{notice('読み込めませんでした。このアプリの正しいバックアップファイルを選んでください。',true);}finally{e.target.value='';}});
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;try{foods=e.newValue===null?[]:decode(e.newValue);storageBroken=false;resetForm();$('use-dialog').close();render();notice('別の画面で変更された在庫を反映しました。');}catch{storageBroken=true;notice('別の画面の保存データを読み込めませんでした。変更を止めています。',true);}});
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>notice('オフライン用の準備ができませんでした。オンラインで在庫管理は利用できます。'));
