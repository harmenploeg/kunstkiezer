import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,editor=true){
 let rows=[{id:'source-1',name:'Museumbron',url:'https://example.test',notes:'Ook beeldenpark en architectuur.',enabled:true,updated_at:'2026-10-04T00:00:00Z'}];let revision=0,conflict=false,sourceReads=0;
 const settings={distance_weight:70,tag_weight:30,distance_scale_km:30,updated_at:'2026-10-04T00:00:00Z'};
 const user={id:'00000000-0000-4000-8000-000000000001',email:'editor@example.test',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-04T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:4000000000},'test'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://management-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 await page.route('https://management-test.supabase.co/**',async route=>{
 const path=new URL(route.request().url()).pathname;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};const reply=(json:unknown,status=200)=>route.fulfill({headers,json,status});
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(path==='/auth/v1/token')return reply({access_token:token,refresh_token:'test',token_type:'bearer',expires_in:3600,user});
 if(path==='/auth/v1/user')return reply(user);
 if(path.endsWith('/kk_is_editor'))return reply(editor);
 if(path.endsWith('/kk_ranking_settings'))return reply(settings);
 if(path.endsWith('/kk_update_sources')){sourceReads++;return reply(rows);}
 if(path.endsWith('/kk_save_update_source')){const input=route.request().postDataJSON();const old=rows.find(r=>r.id===input.source_id);if(conflict||old&&old.updated_at!==input.expected_updated_at)return reply({code:'40001',message:'Changed'},409);const saved={...input.payload,id:old?.id??'new-source',updated_at:`2026-10-04T01:00:0${++revision}Z`};rows=[...rows.filter(r=>r.id!==saved.id),saved];return reply(saved);}
 if(path.endsWith('/kk_delete_update_source')){const input=route.request().postDataJSON();expect(input.expected_updated_at).toBe(rows.find(r=>r.id===input.source_id)?.updated_at);rows=rows.filter(r=>r.id!==input.source_id);return reply(null);}
 return reply({});
 });
 await page.goto('/kunstkiezer/beheer');await page.getByRole('link',{name:/Open beheer/}).click();await expect(page).toHaveURL(/beheer\/instellingen$/);await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password');await page.getByRole('button',{name:'Aanmelden met wachtwoord'}).click();
 return {rows:()=>rows,conflict:(v:boolean)=>{conflict=v;},reads:()=>sourceReads};
}
test('Beheer groepeert ranking en bronnen; toevoegen, uitschakelen, herladen, conflicten en verwijderen',async({page})=>{
 const mock=await setup(page);await expect(page.getByRole('heading',{name:'Afstand en smaak'})).toBeVisible();await expect(page.getByRole('button',{name:/Museumbron/})).toBeVisible();
 await page.getByRole('button',{name:'Bron toevoegen',exact:true}).click();await page.getByLabel('Naam van de bron').fill('Gemeentelijke kunst');await page.getByLabel('Webadres').fill('https://example.test/kunst');await page.getByLabel('Zoekinstructie en aandachtspunten').fill('Opmerkelijke beelden en ensembles.');await page.getByRole('button',{name:'Bron opslaan',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Bron opgeslagen'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:/Gemeentelijke kunst/}).click();await expect(page.getByLabel('Webadres')).toHaveValue('https://example.test/kunst');await page.getByLabel('Meenemen in de maandagupdate').uncheck();await page.getByRole('button',{name:'Bron opslaan',exact:true}).click();await expect(page.getByRole('button',{name:/Gemeentelijke kunst/})).toContainText('Uitgeschakeld');
 await page.getByRole('button',{name:/Gemeentelijke kunst/}).click();mock.conflict(true);await page.getByLabel('Naam van de bron').fill('Niet overschrijven');await page.getByRole('button',{name:'Bron opslaan',exact:true}).click();await expect(page.getByRole('alert')).toContainText('ondertussen gewijzigd');expect(mock.rows().find(r=>r.id==='new-source')?.name).toBe('Gemeentelijke kunst');mock.conflict(false);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Bronnen opnieuw laden'}).click();
 await page.getByRole('button',{name:/Gemeentelijke kunst/}).click();await page.getByRole('button',{name:'Bron verwijderen',exact:true}).click();await page.getByRole('button',{name:'Definitief verwijderen'}).click();await expect(page.getByRole('button',{name:/Gemeentelijke kunst/})).toHaveCount(0);await page.reload();await expect(page.getByRole('button',{name:/Museumbron/})).toBeVisible();expect(mock.rows()).toHaveLength(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`work/management-${test.info().project.name}.png`,fullPage:true});
});
test('Account zonder redactierechten ziet geen bronnen of instellingenformulier',async({page})=>{const mock=await setup(page,false);await expect(page.getByText('Dit account heeft geen redactierechten.')).toBeVisible();await expect(page.getByRole('button',{name:'Bron toevoegen'})).toHaveCount(0);expect(mock.reads()).toBe(0);});
