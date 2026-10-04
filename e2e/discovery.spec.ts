import {test,expect} from '@playwright/test';
import {blankDiscovery} from '../packages/data/src/discovery.ts';
test('Alle vijf keuzes zijn gelijkwaardige links, met afzonderlijk beheer en onderzoeksbestanden',async({page,request})=>{
 await page.goto('/kunstkiezer/agenda');
 const cards=page.locator('.category-card');await expect(cards).toHaveCount(5);
 await page.getByRole('link',{name:/Tentoonstellingen en evenementen/}).click();
 await expect(page.getByRole('heading',{name:'Tentoonstellingen en evenementen.'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Tentoonstellingen en evenementen.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Beheer',exact:true})).toHaveCount(0);
 for(const c of ['openbare-kunst','beeldenparken','architectuur','evenementen']){
  expect((await request.get(`/kunstkiezer/${c}.json`)).status()).toBe(200);
  await page.goto(`/kunstkiezer/beheer/${c}`);await expect(page.getByText('Log in met je beheerdersaccount.')).toBeVisible();await expect(page.getByRole('button',{name:'Opslaan in Supabase'})).toHaveCount(0);
 }
});
test('Redacteur krijgt rode velden en focus, en slaat tags, data en notities atomair op',async({page})=>{
 let row={...blankDiscovery('evenementen'),id:'00000000-0000-4000-8000-000000000010',inventory_key:null,name:'Testexpositie',updated_at:'2026-10-03T10:00:00.000000+00:00'};let saved:Record<string,unknown>|null=null;
 await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://discovery-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 const user={id:'00000000-0000-4000-8000-000000000001',email:'editor@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-03T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:4000000000},'test'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 await page.route('https://discovery-test.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname;const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
  async function reply(json:unknown,extra:Record<string,string>={}){await route.fulfill({json,headers:{...cors,...extra}});}
  if(path==='/auth/v1/user'){await reply(user);return;}
  if(path.endsWith('/kk_profiles')){await reply(null);return;}
  if(path.endsWith('/kk_seen')){await reply([]);return;}
  if(path==='/auth/v1/token'){await reply({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user});return;}
  if(path==='/rest/v1/rpc/kk_is_editor'){await reply(true);return;}
  if(path==='/rest/v1/kk_discoveries'){await reply([row],{'content-range':'0-0/1'});return;}
  if(path==='/rest/v1/kk_discovery_editorial'){await reply({review_notes:''});return;}
  if(path==='/rest/v1/rpc/kk_save_discovery'){saved=route.request().postDataJSON();expect(saved!.expected_updated_at).toBe(row.updated_at);row={...row,...saved!.payload as typeof row,updated_at:'2026-10-03T11:00:00Z'};await reply(row);return;}
  await reply({});
 });
 await page.goto('/kunstkiezer/account');await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password');await page.locator('form').getByRole('button',{name:'Inloggen',exact:true}).click();await expect(page).toHaveURL(/\/kunstkiezer\/(agenda)?$/);await page.goto('/kunstkiezer/beheer/evenementen');
 await page.getByRole('button',{name:/Testexpositie/}).click();await page.getByLabel('Publicatie',{exact:true}).selectOption('published');await page.getByRole('button',{name:'Opslaan in Supabase'}).click();
 await expect(page.getByLabel('Begindatum',{exact:true})).toBeFocused();await expect(page.getByLabel('Begindatum',{exact:true})).toBeInViewport();await expect(page.getByLabel('Begindatum')).toHaveAttribute('aria-invalid','true');expect(saved).toBeNull();
 await page.getByLabel('Plaats',{exact:true}).fill('Utrecht');await page.getByLabel('Begindatum').fill('2026-10-10');await page.getByLabel('Einddatum').fill('2026-11-15');await page.getByLabel('Beschrijving (maximaal 80 woorden)').fill('Een blik op fotografie.');await page.getByLabel('Waarom geselecteerd?').fill('Bijzondere fotografie in Utrecht.');await page.getByLabel('Tags, gescheiden door komma’s').pressSequentially('fotografie, portret');
 await page.getByRole('button',{name:'Bron toevoegen'}).click();await page.getByLabel('Bronnaam 1').fill('Museum');await page.getByLabel('Bronlink 1').fill('https://example.test/expositie');await page.getByLabel('Interne redactienotities').fill('Data bevestigd.');await page.getByRole('button',{name:'Opslaan in Supabase'}).click();await expect(page.getByText('Opgeslagen in Supabase.')).toBeVisible();
 expect(row.tags).toEqual(['fotografie','portret']);expect((saved as unknown as {editorial_notes:string}).editorial_notes).toBe('Data bevestigd.');
});
