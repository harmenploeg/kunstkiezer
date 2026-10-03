import {test,expect} from '@playwright/test';

test('Inventaris en formulier zijn te bekijken; zonder database kan niets worden opgeslagen',async({page})=>{
 await page.goto('/kunstkiezer/beheer/musea');
 await expect(page.getByRole('heading',{name:'Musea beheren.'})).toBeVisible();
 await expect(page.getByText('Museuminventaris — nog niet verbonden met Supabase')).toBeVisible();
 await page.getByLabel('Zoek museum of plaats').fill('Rijksmuseum Amsterdam');
 await page.getByRole('button',{name:/Rijksmuseum Amsterdam/}).click();
 await expect(page.getByLabel('Naam',{exact:true})).toHaveValue('Rijksmuseum Amsterdam');
 await expect(page.getByLabel('Adres',{exact:true})).toHaveValue('Museumstraat 1');
 await expect(page.getByRole('link',{name:'Museum.nl ↗'})).toBeVisible();
 await page.getByLabel("Goedgekeurde tags, gescheiden door komma's").fill('kunst, fotografie');
 await expect(page.getByLabel("Goedgekeurde tags, gescheiden door komma's")).toHaveValue('kunst, fotografie');
 await expect(page.getByRole('button',{name:'Opslaan in Supabase'})).toBeDisabled();
 expect(await page.evaluate(()=>document.body.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
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
 await page.goto('/kunstkiezer/beheer/musea');
 await page.getByLabel('E-mail',{exact:true}).fill('editor@example.test');
 await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password');
 await page.getByRole('button',{name:'Aanmelden met wachtwoord',exact:true}).click();
 await page.getByRole('button',{name:/Testmuseum Utrecht/}).click();
 await page.getByLabel('Tag toevoegen uit de bibliotheek').selectOption('kunst');
 await page.getByLabel('Eigen beschrijving').fill('Eigen gecontroleerde tekst.');
 await page.getByLabel('Interne redactienotities').fill('Adres gecontroleerd.');
 await page.getByRole('button',{name:'Opslaan in Supabase'}).click();
 await expect(page.getByText('Opgeslagen in Supabase.')).toBeVisible();
 expect(savedPayload).not.toBeNull();
 expect(museum.tags).toEqual(['kunst']);
 expect((savedPayload as unknown as Record<string,unknown>).editorial_notes).toBe('Adres gecontroleerd.');
});
