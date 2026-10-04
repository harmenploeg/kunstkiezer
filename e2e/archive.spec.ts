import {test,expect} from '@playwright/test';
import {blankMuseum} from '../packages/data/src/museums.ts';
import {blankDiscovery} from '../packages/data/src/discovery.ts';
for(const museum of [true,false])test(`Beheer kan ${museum?'museum':'onderwerp'} verwijderen, annuleren en herstellen; conflicten blijven zichtbaar`,async({page})=>{
 const table=museum?'kk_museums':'kk_discoveries';
 let row={...(museum?blankMuseum:blankDiscovery('openbare-kunst')),id:'00000000-0000-4000-8000-000000000010',name:'Archieftest',city:'Utrecht',publication_status:'published',updated_at:'2026-10-04T09:00:00Z'};
 let writes=0,conflict=true;
 const user={id:'00000000-0000-4000-8000-000000000001',email:'editor@example.test',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-03T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:4000000000},'test'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://archive-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 await page.route('https://archive-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  const reply=async(json:unknown,extra={})=>route.fulfill({json,headers:{...headers,...extra}});
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  if(path==='/auth/v1/user')return reply(user);
  if(path==='/auth/v1/token')return reply({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user});
  if(path.endsWith('/kk_is_editor'))return reply(true);
  if(path.endsWith('/'+table)){
   if(req.method()==='PATCH'){
    writes++;expect(url.searchParams.get('id')).toBe('eq.'+row.id);expect(url.searchParams.get('updated_at')).toBe('eq.'+row.updated_at);
    if(conflict)return reply(null);
    const body=req.postDataJSON();expect(Object.keys(body)).toEqual(['publication_status']);
    row={...row,...body,updated_at:'2026-10-04T10:00:00Z'};return reply({id:row.id});
   }
   const archive=url.searchParams.get('publication_status')==='eq.archived';const rows=(row.publication_status==='archived')===archive?[row]:[];
   return reply(rows,{'content-range':rows.length?'0-0/1':'*/0'});
  }
  if(path.endsWith('_editorial'))return reply({review_notes:'',suggested_tags:[]});
  if(path.endsWith('/kk_profiles'))return reply(null);
  return reply([]);
 });
 await page.goto('/kunstkiezer/account');await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password');await page.locator('form').getByRole('button',{name:'Inloggen',exact:true}).click();await expect(page).toHaveURL(/\/kunstkiezer\/(agenda)?$/);
 await page.goto(`/kunstkiezer/beheer/${museum?'musea':'openbare-kunst'}`);await page.getByRole('button',{name:/Archieftest Utrecht/}).click();
 await page.getByRole('button',{name:'Onderwerp verwijderen',exact:true}).click();await page.getByRole('button',{name:'Annuleren',exact:true}).click();expect(writes).toBe(0);
 await page.getByRole('button',{name:'Onderwerp verwijderen',exact:true}).click();await page.getByRole('button',{name:'Ja, verwijderen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('ondertussen gewijzigd');
 conflict=false;await page.getByRole('button',{name:'Ja, verwijderen',exact:true}).click();await expect(page.getByText('Onderwerp verwijderd uit het aanbod.')).toBeVisible();await expect(page.getByRole('button',{name:/Archieftest Utrecht/})).toHaveCount(0);
 await page.getByLabel('Toon',{exact:true}).selectOption('archive');await page.getByRole('button',{name:/Archieftest Utrecht/}).click();await page.getByRole('button',{name:'Herstellen als concept'}).click();await expect(page.getByText('Hersteld als concept.')).toBeVisible();expect(row.publication_status).toBe('draft');
 await page.getByLabel('Toon',{exact:true}).selectOption('active');await expect(page.getByRole('button',{name:/Archieftest Utrecht/})).toBeVisible();
});
