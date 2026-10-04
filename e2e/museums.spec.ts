import {test,expect} from '@playwright/test';

test('Gast ziet geen redactiefuncties, ook niet via een directe link',async({page})=>{
 await page.goto('/kunstkiezer/beheer/musea');await expect(page.getByRole('link',{name:'Inloggen',exact:true})).toHaveCount(2);await expect(page.getByRole('heading',{name:'Musea beheren.'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Opslaan in Supabase'})).toHaveCount(0);
});

test('Editor meldt aan en slaat museum plus notities via één Supabase-transactie op',async({page})=>{
 const id='00000000-0000-4000-8000-000000000010';
 let museum={id,inventory_key:null,name:'Testmuseum',city:'Utrecht',province:'Utrecht',street_address:'Teststraat 1',postal_code:'',country:'NL',website_url:'https://example.test',latitude:null,longitude:null,summary:'',operating_status:'unknown',publication_status:'draft',verification_status:'unreviewed',tags:[],updated_at:'2026-10-03T10:00:00.000000+00:00'};
 let savedPayload:Record<string,unknown>|null=null;
 await page.route('**/kunstkiezer/api/config',route=>route.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://museum-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 const user={id:'00000000-0000-4000-8000-000000000001',email:'editor@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-03T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:4000000000},'test'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 await page.route('https://museum-test.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
  async function reply(json:unknown,extra:Record<string,string>={}){await route.fulfill({json,headers:{...cors,...extra}});}
  if(path==='/auth/v1/user'){await reply(user);return;}
  if(path.endsWith('/kk_profiles')){await reply(null);return;}
  if(path.endsWith('/kk_seen')){await reply([]);return;}
  if(path==='/auth/v1/token'){await reply({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user});return;}
  if(path==='/rest/v1/rpc/kk_is_editor'){await reply(true);return;}
  if(path==='/rest/v1/kk_museums'){await reply([museum],{'content-range':'0-0/1'});return;}
  if(path==='/rest/v1/kk_tags'){await reply([{label:'kunst',dimension:'collectie'}]);return;}
  if(path==='/rest/v1/kk_museum_sources'){await reply([]);return;}
  if(path==='/rest/v1/kk_museum_editorial'){await reply({review_notes:'',suggested_tags:[]});return;}
  if(path==='/rest/v1/rpc/kk_save_museum'){
   savedPayload=route.request().postDataJSON() as Record<string,unknown>;
   expect(savedPayload.museum_id).toBe(id);
   expect(savedPayload.expected_updated_at).toBe(museum.updated_at);
   museum={...museum,...savedPayload.payload as typeof museum,updated_at:'2026-10-03T11:00:00.000000+00:00'};
   await reply(museum);return;
  }
  await reply({});
 });
 await page.goto('/kunstkiezer/account');
 await page.getByLabel('E-mail',{exact:true}).fill('editor@example.test');
 await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password');
 await page.locator('form').getByRole('button',{name:'Inloggen',exact:true}).click();await expect(page.getByText('Ingelogd als')).toBeVisible();await page.goto('/kunstkiezer/beheer/musea');
 await page.getByRole('button',{name:/Testmuseum Utrecht/}).click();
 await page.getByLabel('Publicatie',{exact:true}).selectOption('published');
 await page.getByLabel('Plaats',{exact:true}).fill('');
 await page.getByLabel('Bedrijfsstatus',{exact:true}).selectOption('closed');
 await page.getByLabel('Tag toevoegen uit de bibliotheek').selectOption('kunst');
 await page.getByLabel('Collectie').fill(Array(81).fill('kunst').join(' '));
 await page.getByRole('button',{name:'Opslaan in Supabase'}).click();
 await expect(page.getByText('De collectietekst mag maximaal 80 woorden bevatten.')).toBeVisible();
 expect(savedPayload).toBeNull();
 await expect(page.getByLabel('Collectie',{exact:true})).toBeFocused();
 await page.getByLabel('Collectie').fill('Een verrassende collectie moderne kunst.');
 await expect(page.getByLabel('Controle',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Foto toevoegen'}).click();
 await page.getByRole('button',{name:'Opslaan in Supabase'}).click();
 await expect(page.getByLabel('Afbeeldingslink 1',{exact:true})).toBeFocused();
 await expect(page.getByLabel('Afbeeldingslink 1',{exact:true})).toHaveAttribute('aria-invalid','true');
 await page.getByLabel('Afbeeldingslink 1').fill('https://example.test/photo.jpg');
 await page.getByLabel('Onderschrift 1').fill('De museumgevel');
 await page.getByRole('button',{name:'Foto toevoegen'}).click();
 await page.getByLabel('Afbeeldingslink 2').fill('https://example.test/collection.jpg');
 await page.getByRole('button',{name:'Als omslag gebruiken'}).click();
 await expect(page.getByLabel('Afbeeldingslink 1')).toHaveValue('https://example.test/collection.jpg');
 await page.getByLabel('Interne redactienotities').fill('Adres gecontroleerd.');
 await page.getByRole('button',{name:'Opslaan in Supabase'}).click();
 await expect(page.getByText('Opgeslagen in Supabase.')).toBeVisible();
 expect(savedPayload).not.toBeNull();
 expect(museum.tags).toEqual(['kunst']);
 expect(museum.operating_status).toBe('closed');expect(museum.city).toBe('');
 expect(((savedPayload as unknown as Record<string,unknown>).payload as {photos:unknown[]}).photos).toHaveLength(2);
 expect((savedPayload as unknown as Record<string,unknown>).editorial_notes).toBe('Adres gecontroleerd.');
});
