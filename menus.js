'use strict';
const SHOP_KEY='kazuchan-shopping-v1';
let shopping=[],shoppingBroken=false,suggestionsShown=false;
const normalizeName=name=>name.normalize('NFKC').replace(/\((?:冷凍|冷蔵|常温)\)/g,'').replace(/\s/g,'').toLowerCase();
const SEASONINGS=new Set(['醤油','みりん','砂糖','油','ごま油','塩','だし','味噌','酢','すりごま','こしょう','しょうが','水']);
const recipeCategory=r=>r.category||({potato:'soup',tofu:'side'}[r.id]||'main');
let mealFilter='all';
function usableFoods(){return foods.filter(f=>f.quantity>0&&(!f.expiry||daysLeft(f.expiry)>=0));}
function ingredientStatus(ingredient){
 if(ingredient.name==='水')return {kind:'have',label:'水道水を使用',buy:0};
 const matches=usableFoods().filter(f=>ingredient.aliases.some(alias=>normalizeName(alias)===normalizeName(f.name)));
 if(!matches.length)return {kind:'missing',label:'買い足す',buy:ingredient.quantity};
 const same=matches.filter(f=>f.unit===ingredient.unit);const amount=same.reduce((sum,f)=>sum+f.quantity,0);
 if(ingredient.unit==='適量'||same.length!==matches.length)return {kind:'check',label:'在庫あり・分量を確認',buy:null};
 if(amount<ingredient.quantity)return {kind:'short',label:'不足 '+Number((ingredient.quantity-amount).toPrecision(12))+ingredient.unit,buy:Number((ingredient.quantity-amount).toPrecision(12))};
 return {kind:'have',label:'在庫あり',buy:0};
}
function suggestions(){return RECIPE_BOOK.filter(recipe=>mealFilter==='all'||recipeCategory(recipe)===mealFilter).map(recipe=>{const statuses=recipe.ingredients.map(ingredientStatus);const main=recipe.ingredients.map((i,index)=>({i,s:statuses[index]})).filter(({i})=>!SEASONINGS.has(i.name));return {recipe,statuses,matched:statuses.filter(s=>s.kind!=='missing').length,mainMatched:main.filter(({s})=>s.kind!=='missing').length,ratio:main.filter(({s})=>s.kind!=='missing').length/main.length,soon:main.filter(({i})=>usableFoods().some(f=>f.expiry&&daysLeft(f.expiry)<=3&&i.aliases.some(a=>normalizeName(a)===normalizeName(f.name)))).length};}).filter(r=>r.mainMatched>0).sort((a,b)=>b.soon-a.soon||b.ratio-a.ratio||b.mainMatched-a.mainMatched);}
function renderRecipes(){if(!suggestionsShown)return;const list=$('recipe-list');list.replaceChildren();const results=suggestions();$('recipe-count').textContent=results.length+'品の候補 · レシピ全'+RECIPE_BOOK.length+'品';if(!results.length){list.append(el('p','empty','今の在庫に合うレシピはまだありません。食材を登録するか、別の分類を選んでください。'));return;}
 for(const {recipe,statuses,matched,soon} of results){const card=el('article','recipe-card');card.append(el('span','badge',({main:'主菜',side:'副菜',soup:'汁物'}[recipeCategory(recipe)])+' · '+recipe.minutes+'分 · 2人分'),el('h3','',recipe.name),el('p','hint',matched+'種類の食材が在庫にあります。'+(soon?'期限の近い食材を使えます。':'')));
 const ingredients=el('ul','recipe-ingredients');recipe.ingredients.forEach((ingredient,index)=>{const s=statuses[index];ingredients.append(el('li',s.kind==='missing'||s.kind==='short'?'urgent':'',ingredient.name+' '+ingredient.quantity+ingredient.unit+' — '+s.label));});card.append(ingredients);
 const details=el('details');details.append(el('summary','','作り方を見る'));const steps=el('ol');recipe.steps.forEach(step=>steps.append(el('li','',step)));details.append(steps);card.append(details);
 const needed=recipe.ingredients.filter((i,index)=>statuses[index].kind==='missing'||statuses[index].kind==='short');if(needed.length)card.append(action('足りない食材を買い物リストへ','secondary',()=>addShopping(recipe)));else card.append(el('p','hint',statuses.some(s=>s.kind==='check')?'分量を確認してから調理してください。':'必要な食材がそろっています。'));
 list.append(card);}
}
function validShopping(items){return Array.isArray(items)&&items.every(item=>item&&typeof item.name==='string'&&item.name.length>0&&typeof item.done==='boolean'&&Array.isArray(item.sources)&&item.sources.every(s=>typeof s==='string')&&Array.isArray(item.amounts)&&item.amounts.every(a=>typeof a==='string'))&&new Set(items.map(i=>i.name)).size===items.length;}
try{const saved=localStorage.getItem(SHOP_KEY);if(saved!==null){const data=JSON.parse(saved);if(data.version!==1||!validShopping(data.items))throw new Error('invalid');shopping=data.items;}}catch{shoppingBroken=true;notice('買い物リストを読み込めませんでした。元のデータを守るため買い物リストの変更を止めています。',true);}
function saveShopping(next){if(shoppingBroken){notice('買い物リストの保存データを読み込めないため変更できません。',true);return false;}try{localStorage.setItem(SHOP_KEY,JSON.stringify({version:1,items:next}));shopping=next;renderShopping();return true;}catch{notice('買い物リストを保存できませんでした。変更は反映していません。',true);return false;}}
function addShopping(recipe){const next=shopping.map(item=>({...item,amounts:[...item.amounts],sources:[...item.sources]}));let added=0;
 for(const ingredient of recipe.ingredients){const status=ingredientStatus(ingredient);if(status.kind!=='missing'&&status.kind!=='short')continue;const amount=recipe.name+'：'+status.buy+ingredient.unit+(status.kind==='short'?'（不足分）':'');let item=next.find(i=>i.name===ingredient.name);if(!item){item={name:ingredient.name,done:false,amounts:[],sources:[]};next.push(item);}item.done=false;if(!item.amounts.includes(amount))item.amounts.push(amount);if(!item.sources.includes(recipe.name))item.sources.push(recipe.name);added++;}
 if(added&&saveShopping(next)){notice('足りない食材を買い物リストに保存しました。');$('shopping-section').scrollIntoView({behavior:'smooth',block:'start'});}else if(!added)notice('買い足す食材はありません。');
}
function renderShopping(){const list=$('shopping-list');list.replaceChildren();$('shopping-count').textContent=shopping.filter(i=>!i.done).length+'件 未購入';if(!shopping.length){list.append(el('p','empty','献立の「足りない食材を買い物リストへ」から追加できます。'));return;}
 shopping.forEach(item=>{const row=el('div','shopping-item');const label=el('label');const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=item.done;checkbox.addEventListener('change',()=>{if(!saveShopping(shopping.map(i=>i.name===item.name?{...i,done:checkbox.checked}:i)))checkbox.checked=item.done;});label.append(checkbox,el('span',item.done?'bought':'',item.name));row.append(label,el('p','hint',item.amounts.join(' / ')),action('リストから削除','secondary',()=>{if(confirm('「'+item.name+'」を買い物リストから削除しますか？'))saveShopping(shopping.filter(i=>i.name!==item.name));}));list.append(row);});
}
document.querySelectorAll('[data-meal-filter]').forEach(button=>button.addEventListener('click',()=>{mealFilter=button.dataset.mealFilter;document.querySelectorAll('[data-meal-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));suggestionsShown=true;renderRecipes();}));
$('suggest').addEventListener('click',()=>{suggestionsShown=true;renderRecipes();});window.addEventListener('inventory-updated',renderRecipes);
window.addEventListener('storage',event=>{if(event.key!==SHOP_KEY)return;try{const data=event.newValue===null?{version:1,items:[]}:JSON.parse(event.newValue);if(data.version!==1||!validShopping(data.items))throw new Error('invalid');shopping=data.items;shoppingBroken=false;renderShopping();}catch{shoppingBroken=true;notice('買い物リストの保存データを読み込めません。',true);}});
renderShopping();
