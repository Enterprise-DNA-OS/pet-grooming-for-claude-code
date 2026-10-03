#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, pick } from './lib/csv.mjs';

export const TABLES=['clients','pets','staff','resources','services','appointments','payments','vaccinations','care_checks','incidents','waitlist'];
export const READS={
 clients:'SELECT id,name,email,phone,suburb,active FROM clients ORDER BY name',
 pets:'SELECT p.id,p.name,c.name AS client,p.breed,p.temperament,p.rebook_days,p.last_groom,p.active FROM pets p JOIN clients c ON c.id=p.client_id ORDER BY p.name,c.name',
 staff:'SELECT id,name,active FROM staff ORDER BY name',resources:'SELECT id,name,kind,active FROM resources ORDER BY name',services:'SELECT id,name,duration_minutes,price_cents,currency FROM services ORDER BY name',
 'day-sheet':"SELECT * FROM v_schedule WHERE starts_at::date=$1::date AND status NOT IN ('cancelled','no-show') ORDER BY starts_at",
 'van-run':"SELECT * FROM v_schedule WHERE resource_kind='van' AND starts_at::date=$1::date AND status NOT IN ('cancelled','no-show') ORDER BY resource,starts_at",
 appointments:'SELECT * FROM v_schedule ORDER BY starts_at',
 rebooking:'SELECT * FROM v_rebooking WHERE due_on<=current_date+7 OR due_on IS NULL ORDER BY due_on NULLS FIRST',
 balances:'SELECT * FROM v_balances WHERE balance_cents>0 ORDER BY starts_at',
 vaccinations:'SELECT v.id,p.name AS pet,v.name,v.expires_on,v.evidence_ref FROM vaccinations v JOIN pets p ON p.id=v.pet_id ORDER BY v.expires_on',
 waitlist:"SELECT w.id,p.name AS pet,c.name AS client,c.suburb,w.wanted_on,w.notes,w.status FROM waitlist w JOIN pets p ON p.id=w.pet_id JOIN clients c ON c.id=p.client_id ORDER BY w.wanted_on",
 incidents:'SELECT i.id,p.name AS pet,i.summary,i.urgent,i.action,i.resolved_at FROM incidents i JOIN pets p ON p.id=i.pet_id ORDER BY i.created_at',
 'care-checks':'SELECT cc.id,p.name AS pet,cc.kind,cc.observations,cc.recorded_by,cc.checked_at FROM care_checks cc JOIN appointments a ON a.id=cc.appointment_id JOIN pets p ON p.id=a.pet_id ORDER BY cc.checked_at',
 compliance:'SELECT * FROM v_compliance ORDER BY rule,pet', attention:'SELECT * FROM v_attention ORDER BY due_on,pet',
 revenue:"SELECT currency,count(*) AS completed_grooms,sum(price_cents)::integer AS sales_cents,sum(paid_cents)::integer AS paid_cents,sum(balance_cents)::integer AS balance_cents FROM v_balances WHERE status='completed' GROUP BY currency ORDER BY currency"
};
export const QUESTIONS=[
 ['Which overdue pets also have an unresolved care incident?',"SELECT r.pet,r.client,r.due_on,i.summary FROM v_rebooking r JOIN incidents i ON i.pet_id=r.id WHERE r.days_overdue>0 AND i.resolved_at IS NULL"],
 ['Which upcoming appointments lack an emergency veterinary consent reference?',"SELECT s.pet,s.client,s.starts_at,s.resource FROM v_schedule s JOIN appointments a ON a.id=s.id JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=p.client_id WHERE s.starts_at>=now() AND s.status='booked' AND c.consent_ref=''"],
 ['Which overdue pets have both an unpaid groom and a waiting-list request?',"SELECT r.pet,r.client,r.due_on,b.balance_cents,b.currency,w.wanted_on FROM v_rebooking r JOIN appointments a ON a.pet_id=r.id JOIN v_balances b ON b.id=a.id JOIN waitlist w ON w.pet_id=r.id WHERE r.days_overdue>0 AND b.balance_cents>0 AND w.status='open'"],
 ['How many booked minutes does each groomer have in the next seven days?',"SELECT s.name AS groomer,COALESCE(sum(EXTRACT(epoch FROM (a.ends_at-a.starts_at))/60),0)::integer AS booked_minutes FROM staff s LEFT JOIN appointments a ON a.staff_id=s.id AND a.status IN ('booked','checked-in') AND a.starts_at>=now() AND a.starts_at<now()+interval '7 days' GROUP BY s.name ORDER BY s.name"],
 ['Which van visits need special handling, grouped by suburb?',"SELECT pet,suburb,resource,starts_at,temperament,care_notes FROM v_schedule WHERE resource_kind='van' AND starts_at>=now() AND status='booked' AND temperament<>'' ORDER BY suburb,starts_at"],
 ['Which pets are due back but have expired vaccination evidence?',"SELECT r.pet,r.client,r.due_on,max(v.expires_on) AS latest_expiry FROM v_rebooking r JOIN vaccinations v ON v.pet_id=r.id WHERE r.due_on<=current_date GROUP BY r.pet,r.client,r.due_on HAVING max(v.expires_on)<current_date"],
 ['Which completed grooms have no recorded handover?',"SELECT s.pet,s.client,s.starts_at,s.groomer FROM v_schedule s WHERE s.status='completed' AND NOT EXISTS(SELECT 1 FROM care_checks cc WHERE cc.appointment_id=s.id AND cc.kind='handover')"],
 ['Which clients need emergency contact details before their next visit?',"SELECT DISTINCT c.name AS client,c.phone,a.starts_at FROM clients c JOIN pets p ON p.client_id=c.id JOIN appointments a ON a.pet_id=p.id WHERE c.emergency_contact='' AND a.status='booked' AND a.starts_at>=now() ORDER BY a.starts_at"],
 ['Which waiting pets share a suburb with a booked van visit?',"SELECT DISTINCT p.name AS waiting_pet,c.suburb,w.wanted_on,s.resource,s.starts_at FROM waitlist w JOIN pets p ON p.id=w.pet_id JOIN clients c ON c.id=p.client_id JOIN v_schedule s ON s.suburb=c.suburb AND s.resource_kind='van' AND s.status='booked' AND s.starts_at>=now() WHERE w.status='open' ORDER BY w.wanted_on"],
 ['How much remains unpaid from completed work, separated by currency?',"SELECT currency,sum(balance_cents)::integer AS unpaid_cents,count(*) AS unpaid_grooms FROM v_balances WHERE status='completed' AND balance_cents>0 GROUP BY currency ORDER BY currency"]
];
const HELP=`Pet Grooming for Claude Code
Reads: ${Object.keys(READS).join(', ')} [--date=YYYY-MM-DD for day-sheet/van-run]
pet <name-or-id> | client <name-or-id> | questions [--question=1..10]
add client --name= --email= --phone= --suburb= --address= --emergency-contact= --consent-ref=
add pet --name= --client= [--breed= --rebook-days=42 --temperament= --care-notes=]
add staff --name= | add resource --name= --kind=van|salon
add service --name= --minutes= --cents= --currency=NZD|AUD
book --pet= --staff= --resource= --service= --at=ISO-WITH-TIMEZONE [--notes=]
status <appointment-id> --to=checked-in|cancelled|no-show
complete <appointment-id> --notes= (requires admission and handover records)
log <appointment-id> --kind=admission|welfare|handover --observations= --by=
receive <appointment-id> --cents= --reference= (records an external payment only)
vaccinate --pet= --name= --expires=YYYY-MM-DD --evidence=
incident --pet= --summary= [--urgent] | resolve <incident-id> --action=
wait --pet= --date=YYYY-MM-DD [--notes=] | close-wait <waitlist-id>
consent <client> --reference= --emergency-contact=
import moego --file=clients-pets.csv [--map=columns.json] [--dry-run]
export --out=new-private-file.json | draft-rebooking
All commands accept --json. Dates and times are UTC. No messages or payments are sent.`;
function argsOf(argv){const pos=[],opt={};for(const a of argv){if(a.startsWith('--')){const at=a.indexOf('='); const k=a.slice(2,at<0?undefined:at);if(k in opt)throw Error(`Repeated option --${k}`);opt[k]=at<0?true:a.slice(at+1);}else pos.push(a);}return{pos,opt};}
function need(o,k){if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Required --${k}=value`);return o[k].trim();}
function int(v,name,min=0,max=2147483647){if(!/^\d+$/.test(String(v))||Number(v)<min||Number(v)>max)throw Error(`${name} must be an integer from ${min} to ${max}`);return Number(v);}
function day(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Date must be a valid YYYY-MM-DD');return v;}
function stamp(v){if(!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)||isNaN(Date.parse(v)))throw Error('Appointment time requires ISO date, time and timezone');day(v.slice(0,10));return new Date(v).toISOString();}
function choice(v,values){if(!values.includes(v))throw Error(`Choose ${values.join(', ')}`);return v;}
async function tx(db,fn){await db.exec('BEGIN');try{const v=await fn();await db.exec('COMMIT');return v;}catch(e){await db.exec('ROLLBACK');throw e;}}
export async function resolve(db,t,ref){if(!TABLES.includes(t)||!ref)throw Error('Supply a record name or id');const named=['clients','pets','staff','resources','services'].includes(t);const rows=await db.query(`SELECT * FROM ${t} WHERE id::text LIKE $1 ${named?'OR lower(name)=lower($2)':''} ORDER BY id`,named?[String(ref)+'%',ref]:[String(ref)+'%']);if(rows.length!==1){const list=rows.map(r=>`${r.id} ${r.name||''}${r.client_id?' client '+r.client_id:''}`).join('\n');throw Error(`${rows.length?'Ambiguous':'No matching'} ${t}: ${ref}${list?'\n'+list:''}`);}return rows[0];}
async function insert(db,t,fields){const keys=Object.keys(fields);return db.query(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(fields));}
async function importMoego(db,opt){
 const rows=parseCsv(fs.readFileSync(need(opt,'file'),'utf8'));if(!rows.length)throw Error('CSV contains no data rows');
 const mapping=opt.map?JSON.parse(fs.readFileSync(need(opt,'map'),'utf8')):{};
 const defaults={client_id:['Client ID','Customer ID'],client_name:['Client Name','Customer Name'],email:['Email','Email Address'],phone:['Phone','Phone Number'],address:['Address'],suburb:['Suburb','City'],pet_id:['Pet ID'],pet_name:['Pet Name'],breed:['Breed','Pet Breed'],species:['Species','Pet Type']};
 for(const [k,h]of Object.entries(mapping)){if(!(k in defaults)||typeof h!=='string'||!Object.keys(rows[0]).includes(h))throw Error(`Invalid mapping ${k}: ${h}`);}
 const seen=new Set(),clients=new Map();const prepared=rows.map((raw,i)=>{const r={};for(const[k,heads]of Object.entries(defaults))r[k]=pick(raw,...(mapping[k]?[mapping[k]]:heads)).trim();for(const k of ['client_id','client_name','pet_id','pet_name'])if(!r[k])throw Error(`CSV row ${i+2}: missing ${k}. Use --map for your export headings.`);if(seen.has(r.pet_id))throw Error(`Duplicate Pet ID ${r.pet_id}`);seen.add(r.pet_id);const c=JSON.stringify([r.client_name,r.email,r.phone,r.address,r.suburb]);if(clients.has(r.client_id)&&clients.get(r.client_id)!==c)throw Error(`Conflicting client details for ${r.client_id}`);clients.set(r.client_id,c);return{...r,raw};});
 return tx(db,async()=>{
  await db.exec('LOCK TABLE clients, pets IN SHARE ROW EXCLUSIVE MODE');
  for(const r of prepared){const existing=await db.query('SELECT c.external_id FROM pets p JOIN clients c ON c.id=p.client_id WHERE p.external_id=$1',[r.pet_id]);if(existing.length&&existing[0].external_id!==r.client_id)throw Error(`Pet ${r.pet_id} belongs to another client. Resolve ownership manually.`);}
  if(opt['dry-run'])return[{dry_run:true,clients:clients.size,pets:prepared.length,scope:'Client and pet identity only; no appointments, payments, consent or care history'}];
  for(const r of prepared){const[c]=await db.query(`INSERT INTO clients(name,external_id,email,phone,address,suburb,raw_import) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(external_id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,address=excluded.address,suburb=excluded.suburb,raw_import=excluded.raw_import RETURNING id`,[r.client_name,r.client_id,r.email,r.phone,r.address,r.suburb,JSON.stringify(r.raw)]);
   await db.query(`INSERT INTO pets(client_id,external_id,name,breed,species,raw_import) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(external_id) DO UPDATE SET name=excluded.name,breed=excluded.breed,species=excluded.species,raw_import=excluded.raw_import`,[c.id,r.pet_id,r.pet_name,r.breed,r.species||'unknown',JSON.stringify(r.raw)]);
  }return[{imported_clients:clients.size,imported_pets:prepared.length,scope:'Identity imported; review raw columns and reconcile other history separately'}];
 });
}
export async function run(db,argv){
 const{pos,opt}=argsOf(argv),[cmd,ref]=pos;
 if(!cmd||opt.help)return[{help:HELP}];
 if(READS[cmd]){const param=['day-sheet','van-run'].includes(cmd)?[day(opt.date||new Date().toISOString().slice(0,10))]:[];return db.query(READS[cmd],param);}
 if(cmd==='questions'){const n=opt.question?int(opt.question,'question',1,10):null;const result=[];for(let i=0;i<QUESTIONS.length;i++){if(n&&n!==i+1)continue;const[q,sql]=QUESTIONS[i];result.push({number:i+1,question:q,answers:await db.query(sql)});}return result;}
 if(cmd==='pet'){const p=await resolve(db,'pets',ref);return{pet:p,client:await resolve(db,'clients',p.client_id),appointments:await db.query('SELECT * FROM v_schedule WHERE id IN (SELECT id FROM appointments WHERE pet_id=$1) ORDER BY starts_at',[p.id]),incidents:await db.query('SELECT * FROM incidents WHERE pet_id=$1',[p.id])};}
 if(cmd==='client'){const c=await resolve(db,'clients',ref);return{client:c,pets:await db.query('SELECT * FROM pets WHERE client_id=$1',[c.id]),balances:await db.query('SELECT * FROM v_balances WHERE id IN(SELECT a.id FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE p.client_id=$1)',[c.id])};}
 if(cmd==='import'){if(ref!=='moego')throw Error('Use import moego');return importMoego(db,opt);}
 if(cmd==='export'){const out=path.resolve(need(opt,'out'));const data=await tx(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const d={format:'pet-grooming-v1',exported_at:new Date().toISOString()};for(const t of TABLES)d[t]=await db.query(`SELECT * FROM ${t} ORDER BY id`);return d;});fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return[{file:out,record_types:TABLES.length}];}
 if(cmd==='draft-rebooking'){const rows=await db.query(READS.rebooking);const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`rebooking-${randomUUID()}.md`);fs.writeFileSync(file,'# Rebooking drafts for operator review\n\nNothing has been sent. Check care notes, consent and availability before contacting anyone.\n\n'+rows.map(r=>`## ${r.client}: ${r.pet}\n\nContact: ${r.phone||'missing'}\nCare notes: ${r.care_notes}\n\nHello ${r.client}, we are reviewing ${r.pet}'s grooming cycle. Please let us know a suitable time to discuss the next visit.\n`).join('\n'),{flag:'wx',mode:0o600});return[{file,drafts:rows.length,sent:false}];}
 return tx(db,async()=>{
 if(cmd==='add'){
  const name=need(opt,'name');
  if(ref==='client')return insert(db,'clients',{name,email:opt.email||'',phone:opt.phone||'',address:opt.address||'',suburb:opt.suburb||'',emergency_contact:opt['emergency-contact']||'',consent_ref:opt['consent-ref']||''});
  if(ref==='pet'){const c=await resolve(db,'clients',need(opt,'client'));return insert(db,'pets',{name,client_id:c.id,breed:opt.breed||'',temperament:opt.temperament||'',care_notes:opt['care-notes']||'',rebook_days:int(opt['rebook-days']||42,'rebook-days',1,730)});}
  if(ref==='staff')return insert(db,'staff',{name});
  if(ref==='resource')return insert(db,'resources',{name,kind:choice(need(opt,'kind'),['van','salon'])});
  if(ref==='service')return insert(db,'services',{name,duration_minutes:int(need(opt,'minutes'),'minutes',1,720),price_cents:int(need(opt,'cents'),'cents'),currency:choice(need(opt,'currency'),['NZD','AUD'])});
  throw Error('Add client, pet, staff, resource or service');
 }
 if(cmd==='book'){
  await db.exec('LOCK TABLE appointments IN SHARE ROW EXCLUSIVE MODE');
  const p=await resolve(db,'pets',need(opt,'pet')),c=await resolve(db,'clients',p.client_id),s=await resolve(db,'staff',need(opt,'staff')),r=await resolve(db,'resources',need(opt,'resource')),v=await resolve(db,'services',need(opt,'service'));
  if(!p.active||!c.active||!s.active||!r.active)throw Error('Inactive pet, client, staff or resource');
  const start=stamp(need(opt,'at')),end=new Date(Date.parse(start)+v.duration_minutes*60000).toISOString();
  if(Date.parse(start)<Date.now())throw Error('New bookings must be in the future');
  const conflicts=await db.query("SELECT id FROM appointments WHERE status IN ('booked','checked-in') AND starts_at<$2 AND ends_at>$1 AND (pet_id=$3 OR staff_id=$4 OR resource_id=$5)",[start,end,p.id,s.id,r.id]);if(conflicts.length)throw Error(`Booking overlaps ${conflicts.map(c=>c.id).join(', ')}`);
  return insert(db,'appointments',{pet_id:p.id,staff_id:s.id,resource_id:r.id,service_id:v.id,starts_at:start,ends_at:end,price_cents:v.price_cents,currency:v.currency,notes:opt.notes||''});
 }
 if(['status','complete','receive','log'].includes(cmd)){
  const found=await resolve(db,'appointments',ref);const[a]=await db.query('SELECT * FROM appointments WHERE id=$1 FOR UPDATE',[found.id]);
  if(cmd==='receive'){if(a.status!=='completed')throw Error('Record payments only against completed grooms');const amount=int(need(opt,'cents'),'cents',1),reference=need(opt,'reference');const[balance]=await db.query('SELECT balance_cents FROM v_balances WHERE id=$1',[a.id]);if(amount>balance.balance_cents)throw Error('Payment exceeds outstanding balance');return insert(db,'payments',{appointment_id:a.id,amount_cents:amount,reference});}
  if(cmd==='log'){if(!['checked-in','completed'].includes(a.status))throw Error('Check the appointment in before recording care');return insert(db,'care_checks',{appointment_id:a.id,kind:choice(need(opt,'kind'),['admission','welfare','handover']),observations:need(opt,'observations'),recorded_by:need(opt,'by')});}
  if(cmd==='status'){const to=choice(need(opt,'to'),['checked-in','cancelled','no-show']);if(a.status!=='booked')throw Error('Only booked appointments can change to this status');if(to==='checked-in'&&Date.parse(a.starts_at)>Date.now())throw Error('Cannot check in before the booked start');return db.query('UPDATE appointments SET status=$2 WHERE id=$1 RETURNING *',[a.id,to]);}
  if(a.status!=='checked-in')throw Error('Only checked-in appointments can complete');
  const checks=await db.query('SELECT DISTINCT kind FROM care_checks WHERE appointment_id=$1',[a.id]);if(!['admission','handover'].every(k=>checks.some(c=>c.kind===k)))throw Error('Completion needs admission and handover observations');
  await db.query("UPDATE appointments SET status='completed',notes=$2 WHERE id=$1",[a.id,need(opt,'notes')]);await db.query('UPDATE pets SET last_groom=GREATEST(last_groom,current_date) WHERE id=$1',[a.pet_id]);await db.query("UPDATE waitlist SET status='closed' WHERE pet_id=$1 AND status='open'",[a.pet_id]);return db.query('SELECT * FROM v_balances WHERE id=$1',[a.id]);
 }
 if(cmd==='vaccinate'){const p=await resolve(db,'pets',need(opt,'pet'));return insert(db,'vaccinations',{pet_id:p.id,name:need(opt,'name'),expires_on:day(need(opt,'expires')),evidence_ref:need(opt,'evidence')});}
 if(cmd==='incident'){const p=await resolve(db,'pets',need(opt,'pet'));if(opt.urgent!==undefined&&opt.urgent!==true)throw Error('Use --urgent without a value');return insert(db,'incidents',{pet_id:p.id,summary:need(opt,'summary'),urgent:opt.urgent===true});}
 if(cmd==='resolve'){const i=await resolve(db,'incidents',ref);if(i.resolved_at)throw Error('Incident is already resolved');return db.query('UPDATE incidents SET action=$2,resolved_at=now() WHERE id=$1 RETURNING *',[i.id,need(opt,'action')]);}
 if(cmd==='wait'){const p=await resolve(db,'pets',need(opt,'pet'));return insert(db,'waitlist',{pet_id:p.id,wanted_on:day(need(opt,'date')),notes:opt.notes||''});}
 if(cmd==='close-wait'){const w=await resolve(db,'waitlist',ref);return db.query("UPDATE waitlist SET status='closed' WHERE id=$1 RETURNING *",[w.id]);}
 if(cmd==='consent'){const c=await resolve(db,'clients',ref);return db.query('UPDATE clients SET consent_ref=$2,emergency_contact=$3 WHERE id=$1 RETURNING id,name,consent_ref,emergency_contact',[c.id,need(opt,'reference'),need(opt,'emergency-contact')]);}
 throw Error(`Unknown command ${cmd}. Use --help.`);
 });
}
function display(result,cmd){if(!Array.isArray(result))return JSON.stringify(result,null,2);if(result[0]?.help)return result[0].help;if(!result.length)return '  (none)';const visible={attention:['pet','reason','due_on'],rebooking:['pet','client','due_on','days_overdue'], 'van-run':['starts_at','pet','suburb','groomer','resource'],compliance:['pet','rule','issue']}[cmd];const rows=result.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>!visible||visible.includes(k)).map(([k,v])=>[k,v instanceof Date?v.toISOString():typeof v==='object'&&v!==null?JSON.stringify(v):v])));return table(rows,Object.keys(rows[0]).map(k=>({key:k,label:k,width:k==='id'||k==='record_id'?36:100})));}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{if(process.argv.includes('--help')||process.argv.length===2){console.log(HELP);}else{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):display(result,process.argv[2]));}}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
