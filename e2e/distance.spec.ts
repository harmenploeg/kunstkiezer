import {test,expect,type Page} from '@playwright/test';
const tags=['a','b','c','d','e','f'];
async function catalog(page:Page){
 await page.addInitScript(tags=>{localStorage.setItem('kunstkiezer.profile.v1',JSON.stringify({version:1,completed:true,tags}));},tags);
 await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://distance-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 await page.route('https://distance-test.supabase.co/**',async route=>{
 const u=new URL(route.request().url());const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,OPTIONS','content-range':'0-1/2'};
 if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
 if(u.pathname.endsWith('/kk_ranking_settings')){await route.fulfill({headers,json:{distance_weight:70,tag_weight:30,distance_scale_km:30,updated_at:'2026-10-03T00:00:00Z'}});return;}
 const category=u.searchParams.get('category')?.replace('eq.','')??'musea';
 const base={category,city:'Utrecht',province:'Utrecht',street_address:'Teststraat',postal_code:'',website_url:'',summary:'Een collectie.',creator:'',year:'',photos:[],sources:[],selection_reason:'Collectie.',visit_notes:'',operating_status:'open',publication_status:'published',starts_on:'2026-01-01',ends_on:'2099-01-01',longitude:5,coordinate_precision:'city'};
 await route.fulfill({headers,json:[{...base,id:'near',name:'Dichtbij',latitude:52.089932,tags:['a']},{...base,id:'far',name:'Ver weg',latitude:54.2483,tags}]});
 });
}
test('Alle vijf categorieën wegen afstand; bezoeker kan ondanks toestemming uitschakelen en keuze blijft bewaard',async({page,context})=>{
 await catalog(page);await context.setGeolocation({latitude:52,longitude:5});await context.grantPermissions(['geolocation']);
 for(const category of ['musea','openbare-kunst','beeldenparken','architectuur','evenementen']){
 await page.goto('/kunstkiezer/agenda/'+category);await expect(page.getByLabel('Afstand laten meetellen',{exact:true})).not.toBeChecked();await expect(page.locator('.museum-card h2').first()).toHaveText('Ver weg');
 await page.getByLabel('Afstand laten meetellen',{exact:true}).check();await expect(page.locator('.museum-card h2').first()).toHaveText('Dichtbij');await expect(page.locator('.distance-label').first()).toContainText('10 km hemelsbreed · schatting op plaatsniveau');
 expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('location')))).toBe(false);
 await page.getByLabel('Afstand laten meetellen',{exact:true}).uncheck();await expect(page.locator('.museum-card h2').first()).toHaveText('Ver weg');await expect(page.locator('.distance-label')).toHaveCount(0);
 await page.reload();await expect(page.getByLabel('Afstand laten meetellen',{exact:true})).not.toBeChecked();await expect(page.locator('.museum-card h2').first()).toHaveText('Ver weg');
 }
 await page.getByRole('link',{name:'Mijn profiel',exact:true}).click();await expect(page.getByLabel('Afstand laten meetellen',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.body.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
test('Geen automatische locatievraag; weigering en timeout laten de smaakvolgorde intact',async({page})=>{
 await catalog(page);await page.addInitScript(()=>{let count=0;Object.defineProperty(window,'locationRequests',{get:()=>count});Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_ok:unknown,no:(e:{code:number})=>void)=>{count++;no({code:count===1?1:3});}}});});
 await page.goto('/kunstkiezer/agenda/musea');await expect(page.locator('.museum-card h2').first()).toHaveText('Ver weg');expect(await page.evaluate(()=>(window as unknown as {locationRequests:number}).locationRequests)).toBe(0);
 await page.getByLabel('Afstand laten meetellen',{exact:true}).click();await expect(page.getByText(/Geen locatietoestemming/)).toBeVisible();await expect(page.locator('.museum-card h2').first()).toHaveText('Ver weg');await expect(page.getByLabel('Afstand laten meetellen',{exact:true})).not.toBeChecked();
 await page.getByLabel('Afstand laten meetellen',{exact:true}).click();await expect(page.getByText(/duurde te lang/)).toBeVisible();await expect(page.locator('.museum-card h2').first()).toHaveText('Ver weg');
});
test('Uitzetten negeert een locatie die later alsnog binnenkomt',async({page})=>{
 await catalog(page);await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok:(v:unknown)=>void)=>{(window as unknown as {returnLocation:()=>void}).returnLocation=()=>ok({coords:{latitude:52,longitude:5,accuracy:5}});}}}));
 await page.goto('/kunstkiezer/agenda/musea');await page.getByLabel('Afstand laten meetellen',{exact:true}).check();await expect(page.getByText(/Je locatie wordt opgehaald/)).toBeVisible();await page.getByLabel('Afstand laten meetellen',{exact:true}).uncheck();await page.evaluate(()=>(window as unknown as {returnLocation:()=>void}).returnLocation());await expect(page.locator('.museum-card h2').first()).toHaveText('Ver weg');await expect(page.getByLabel('Afstand laten meetellen',{exact:true})).not.toBeChecked();expect(await page.evaluate(()=>sessionStorage.getItem('kunstkiezer.location.session'))).toBeNull();
});
test('Redacteur kan gewichten opslaan en het voorbeeld verandert direct',async({page})=>{
 let settings={distance_weight:70,tag_weight:30,distance_scale_km:30,updated_at:'2026-10-03T00:00:00Z'};let saves=0;
 await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://ranking-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 const user={id:'00000000-0000-4000-8000-000000000001',email:'editor@example.test',aud:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-03T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:4000000000},'test'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 await page.route('https://ranking-test.supabase.co/**',async route=>{
 const path=new URL(route.request().url()).pathname;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
 if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
 const reply=(json:unknown)=>route.fulfill({headers,json});
 if(path==='/auth/v1/token')return reply({access_token:token,refresh_token:'test',token_type:'bearer',expires_in:3600,user});
 if(path.endsWith('/kk_is_editor'))return reply(true);
 if(path.endsWith('/kk_ranking_settings'))return reply(settings);
 if(path.endsWith('/kk_save_ranking_settings')){const input=route.request().postDataJSON();expect(input.expected_updated_at).toBe(settings.updated_at);settings={distance_weight:input.distance_weight,tag_weight:input.tag_weight,distance_scale_km:input.distance_scale_km,updated_at:'2026-10-03T01:00:00Z'};saves++;return reply(settings);}
 return reply({});
 });
 await page.goto('/kunstkiezer/beheer');await page.getByRole('link',{name:/Afstand en smaak/}).click();await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password');await page.getByRole('button',{name:'Aanmelden met wachtwoord'}).click();await expect(page.getByText('De plek op 10 km komt bovenaan.')).toBeVisible();
 await page.getByLabel('Gewicht smaak (%)',{exact:true}).fill('90');await expect(page.getByLabel('Gewicht afstand (%)',{exact:true})).toHaveValue('10');await expect(page.getByText('De plek op 250 km komt bovenaan.')).toBeVisible();await page.getByRole('button',{name:'Instellingen opslaan'}).click();await expect(page.getByText('Opgeslagen. Deze instellingen gelden voor alle vijf categorieën.')).toBeVisible();expect(saves).toBe(1);expect(settings.tag_weight).toBe(90);
 expect(await page.evaluate(()=>document.body.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:`work/distance/admin-${test.info().project.name}.png`,fullPage:true});
});
