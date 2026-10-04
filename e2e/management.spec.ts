import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,editor=true){
 let tags=[{label:'fotografie',dimension:'onderwerp',description:'Foto’s',enabled:true,updated_at:'v1'}];let questions={questions:[{title:'Wat zie je graag?',description:'Kies kunst.',options:[{label:'Foto’s',tags:['fotografie']}]}],updated_at:'v1'};
 let schedule={enabled:true,weekday:1,local_time:'09:00',next_due:'2026-10-05T07:00:00Z',updated_at:'v1'};let runs:unknown[]=[];let members=[{user_id:'member-1',email:'visitor@example.test',is_admin:false}];
 let rows=[{id:'source-1',name:'Museumbron',url:'https://example.test',notes:'Ook beeldenpark en architectuur.',enabled:true,updated_at:'2026-10-04T00:00:00Z'}];let revision=0,conflict=false,sourceReads=0;
 const settings={distance_weight:70,tag_weight:30,distance_scale_km:30,updated_at:'2026-10-04T00:00:00Z'};
 const user={id:'00000000-0000-4000-8000-000000000001',email:'editor@example.test',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-04T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:4000000000},'test'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://management-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 await page.route('https://management-test.supabase.co/**',async route=>{
 const path=new URL(route.request().url()).pathname;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};const reply=(json:unknown,status=200)=>route.fulfill({headers,json,status});
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(path==='/auth/v1/user')return reply(user);
 if(path.endsWith('/kk_profiles'))return reply(null);
 if(['/kk_museums','/kk_discoveries','/kk_rating_totals'].some(x=>path.endsWith(x)))return reply([]);
 if(path.endsWith('/kk_tags')){if(route.request().method()==='PATCH'){tags=tags.map(t=>({...t,...route.request().postDataJSON(),updated_at:'v2'}));return reply(tags[0]);}return reply(tags);}
 if(path.endsWith('/kk_preference_questions')){if(route.request().method()==='PATCH'){const b=route.request().postDataJSON();questions={...b,updated_at:'v2'};return reply({updated_at:'v2'});}return reply(questions);}
 if(path.endsWith('/kk_seen'))return reply([]);
 if(path.endsWith('/kk_update_runs'))return reply(runs);
 if(path.endsWith('/kk_list_members'))return reply(members);
 if(path.endsWith('/kk_set_admin')){const b=route.request().postDataJSON();members=members.map(m=>m.user_id===b.member_id?{...m,is_admin:b.allowed}:m);return reply(null);}
 if(path.endsWith('/kk_request_update')){runs=[{id:'run-1',status:'queued',reason:'manual',requested_at:'2026-10-04T07:00:00Z',started_at:null,finished_at:null,summary:''}];return reply('run-1');}
 if(path.endsWith('/kk_update_schedule')){if(route.request().method()==='PATCH')schedule={...schedule,...route.request().postDataJSON(),updated_at:'v2'};return reply(schedule);}
 if(path==='/auth/v1/token')return reply({access_token:token,refresh_token:'test',token_type:'bearer',expires_in:3600,user});
 if(path==='/auth/v1/user')return reply(user);
 if(path.endsWith('/kk_is_editor'))return reply(editor);
 if(path.endsWith('/kk_ranking_settings'))return reply(settings);
 if(path.endsWith('/kk_update_sources')){sourceReads++;return reply(rows);}
 if(path.endsWith('/kk_save_update_source')){const input=route.request().postDataJSON();const old=rows.find(r=>r.id===input.source_id);if(conflict||old&&old.updated_at!==input.expected_updated_at)return reply({code:'40001',message:'Changed'},409);const saved={...input.payload,id:old?.id??'new-source',updated_at:`2026-10-04T01:00:0${++revision}Z`};rows=[...rows.filter(r=>r.id!==saved.id),saved];return reply(saved);}
 if(path.endsWith('/kk_delete_update_source')){const input=route.request().postDataJSON();expect(input.expected_updated_at).toBe(rows.find(r=>r.id===input.source_id)?.updated_at);rows=rows.filter(r=>r.id!==input.source_id);return reply(null);}
 return reply({});
 });
 await page.goto('/kunstkiezer/account');await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password');await page.locator('form').getByRole('button',{name:'Inloggen'}).click();await expect(page.getByText('Ingelogd als')).toBeVisible();await page.goto('/kunstkiezer/beheer/instellingen');
 return {rows:()=>rows,conflict:(v:boolean)=>{conflict=v;},reads:()=>sourceReads};
}
test('Beheer groepeert ranking en bronnen; toevoegen, uitschakelen, herladen, conflicten en verwijderen',async({page})=>{
 const mock=await setup(page);await expect(page.locator('#volgorde').getByRole('heading',{name:'Volgorde en waarderingen',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Museumbron/})).toBeVisible();
 await page.getByRole('button',{name:'Bron toevoegen',exact:true}).click();await page.getByLabel('Naam van de bron').fill('Gemeentelijke kunst');await page.getByLabel('Webadres').fill('https://example.test/kunst');await page.getByLabel('Zoekinstructie en aandachtspunten').fill('Opmerkelijke beelden en ensembles.');await page.getByRole('button',{name:'Bron opslaan',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Bron opgeslagen'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:/Gemeentelijke kunst/}).click();await expect(page.getByLabel('Webadres')).toHaveValue('https://example.test/kunst');await page.getByLabel('Meenemen in de update').uncheck();await page.getByRole('button',{name:'Bron opslaan',exact:true}).click();await expect(page.getByRole('button',{name:/Gemeentelijke kunst/})).toContainText('Uitgeschakeld');
 await page.getByRole('button',{name:/Gemeentelijke kunst/}).click();mock.conflict(true);await page.getByLabel('Naam van de bron').fill('Niet overschrijven');await page.getByRole('button',{name:'Bron opslaan',exact:true}).click();await expect(page.getByRole('alert')).toContainText('ondertussen gewijzigd');expect(mock.rows().find(r=>r.id==='new-source')?.name).toBe('Gemeentelijke kunst');mock.conflict(false);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Bronnen opnieuw laden'}).click();
 await page.getByRole('button',{name:/Gemeentelijke kunst/}).click();await page.getByRole('button',{name:'Bron verwijderen',exact:true}).click();await page.getByRole('button',{name:'Definitief verwijderen'}).click();await expect(page.getByRole('button',{name:/Gemeentelijke kunst/})).toHaveCount(0);await page.reload();await expect(page.getByRole('button',{name:/Museumbron/})).toBeVisible();expect(mock.rows()).toHaveLength(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`work/management-${test.info().project.name}.png`,fullPage:true});
});
test('Account zonder redactierechten ziet geen bronnen of instellingenformulier',async({page})=>{const mock=await setup(page,false);await expect(page.getByText('Deze pagina is alleen beschikbaar voor beheerders.')).toBeVisible();await expect(page.getByRole('button',{name:'Bron toevoegen'})).toHaveCount(0);expect(mock.reads()).toBe(0);});
test('Beheer kan extra update aanvragen, weekschema wijzigen en beheerder aanwijzen',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Nu updaten',exact:true}).click();await expect(page.getByText('In de wachtrij',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Update aangevraagd of bezig',exact:true})).toBeDisabled();
 await page.getByLabel('Dag',{exact:true}).selectOption('3');await page.getByLabel('Tijd (Nederland)',{exact:true}).fill('14:30');await page.getByRole('button',{name:'Updateschema opslaan',exact:true}).click();await expect(page.getByText('Updateschema opgeslagen.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Dag',{exact:true})).toHaveValue('3');await expect(page.getByLabel('Tijd (Nederland)',{exact:true})).toHaveValue('14:30');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Maak beheerder',exact:true}).click();await expect(page.getByRole('button',{name:'Beheer intrekken',exact:true})).toBeVisible();
});

test('Tagbeheer toont vraagkoppelingen en bewaart vraagteksten en beschikbaarheid',async({page})=>{
 await setup(page);const admin=page.getByRole('region',{name:'Tagbeheer',exact:true});await admin.locator('summary').filter({hasText:'fotografie'}).click();await expect(admin.getByText('Gekoppelde antwoorden: Wat zie je graag? → Foto’s')).toBeVisible();await admin.getByLabel('Vraag',{exact:true}).fill('Welke kunst spreekt je aan?');await admin.getByRole('button',{name:'Vragen en tags opslaan'}).click();await expect(admin.getByRole('status')).toHaveText('Opgeslagen.');await page.reload();await expect(admin.getByLabel('Vraag',{exact:true})).toHaveValue('Welke kunst spreekt je aan?');await admin.locator('summary').filter({hasText:'fotografie'}).click();await admin.getByLabel('Beschikbaar als profielkeuze').uncheck();await admin.getByRole('button',{name:'Tag opslaan',exact:true}).click();await expect(admin.locator('summary')).toContainText('uitgeschakeld');
});
